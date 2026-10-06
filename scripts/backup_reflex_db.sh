#!/usr/bin/env bash
# Encrypted, off-host backup of reflex.db via restic.
#
# Destination-agnostic: everything about WHERE the backup goes comes from
# the config file below (RESTIC_REPOSITORY + credentials). This script does
# not know or care whether that resolves to Backblaze B2, SFTP, or anything
# else restic supports.
#
# Usage:
#   backup_reflex_db.sh [backup|restore-test]
#
#   backup        (default) snapshot + upload + apply retention.
#   restore-test  restore the latest snapshot into a temp dir, verify
#                 integrity, and compare row counts against the live DB.
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RESTIC="/usr/bin/restic"
SQLITE3="/usr/bin/sqlite3"
PYTHON3="/usr/bin/python3"

readonly BACKUP_TAG="reflex-db"
readonly BACKUP_HOST="links-bio"
# User-data tables that cannot be regenerated: restore-test fails if one is
# missing or empty in the restored copy while the live DB has rows.
# (albums/tracks/similar_bands are sync-rebuildable and are shown for
# diagnostics only, not checked.)
readonly USER_DATA_TABLES=(submissions newsletter_subscribers contact_messages)
readonly DIAGNOSTIC_TABLES=(albums tracks similar_bands)

CONFIG_FILE="${REFLEX_BACKUP_ENV:-${XDG_CONFIG_HOME:-$HOME/.config}/reflex-backup/env}"
LOCK_FILE="${REFLEX_BACKUP_LOCK_FILE:-${XDG_RUNTIME_DIR:-/tmp}/reflex-db-backup.lock}"

WORK_DIR=""
cleanup() {
    [[ -n "$WORK_DIR" && -d "$WORK_DIR" ]] && rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

log() { echo "[reflex-db-backup] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }
die() { log "ERROR: $*"; exit 1; }

load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        set -a
        # shellcheck disable=SC1090
        source "$CONFIG_FILE"
        set +a
    fi
    REFLEX_DB="${REFLEX_DB:-$REPO_ROOT/reflex.db}"
    KEEP_DAILY="${KEEP_DAILY:-14}"
    KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
    KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
    MAX_SNAPSHOT_AGE_HOURS="${MAX_SNAPSHOT_AGE_HOURS:-48}"
}

require_config() {
    [[ -n "${RESTIC_REPOSITORY:-}" ]] || die "RESTIC_REPOSITORY is not set (config file: $CONFIG_FILE)"
    if [[ -z "${RESTIC_PASSWORD_FILE:-}" && -z "${RESTIC_PASSWORD:-}" ]]; then
        die "no restic password source set: define RESTIC_PASSWORD_FILE (preferred) or RESTIC_PASSWORD in $CONFIG_FILE"
    fi
    if [[ -n "${RESTIC_PASSWORD_FILE:-}" && ! -f "$RESTIC_PASSWORD_FILE" ]]; then
        die "RESTIC_PASSWORD_FILE points to a missing file: $RESTIC_PASSWORD_FILE"
    fi
}

acquire_lock() {
    exec {LOCK_FD}>"$LOCK_FILE"
    if ! flock -n "$LOCK_FD"; then
        die "another reflex-db-backup run is already in progress (lock file: $LOCK_FILE)"
    fi
}

# --- SQLite helpers: prefer the sqlite3 CLI (absolute path, never the
# Android SDK copy that may shadow it in a user's PATH), fall back to
# python3's sqlite3 module. Both use the online backup API / a read-only
# URI, never a raw file copy of a live database. ---------------------------

sqlite_online_backup() { # src dst
    local src="$1" dst="$2"
    if [[ -x "$SQLITE3" ]]; then
        "$SQLITE3" "file:${src}?mode=ro" ".backup ${dst}"
    else
        "$PYTHON3" - "$src" "$dst" <<'PYEOF'
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
source = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
dest = sqlite3.connect(dst)
with dest:
    source.backup(dest)
source.close()
dest.close()
PYEOF
    fi
}

sqlite_integrity_check() { # db
    local db="$1"
    if [[ -x "$SQLITE3" ]]; then
        "$SQLITE3" "file:${db}?mode=ro" 'PRAGMA integrity_check;'
    else
        "$PYTHON3" - "$db" <<'PYEOF'
import sqlite3, sys
conn = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
for row in conn.execute("PRAGMA integrity_check;"):
    print(row[0])
conn.close()
PYEOF
    fi
}

sqlite_count() { # db table
    local db="$1" table="$2"
    if [[ -x "$SQLITE3" ]]; then
        "$SQLITE3" "file:${db}?mode=ro" "SELECT COUNT(*) FROM \"${table}\";"
    else
        "$PYTHON3" - "$db" "$table" <<'PYEOF'
import sqlite3, sys
conn = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
print(conn.execute(f'SELECT COUNT(*) FROM "{sys.argv[2]}"').fetchone()[0])
conn.close()
PYEOF
    fi
}

do_backup() {
    [[ -f "$REFLEX_DB" ]] || die "REFLEX_DB not found: $REFLEX_DB"

    WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/reflex-db-backup.XXXXXX")"
    local snapshot="$WORK_DIR/reflex.db"

    log "Taking a consistent snapshot of $REFLEX_DB"
    sqlite_online_backup "$REFLEX_DB" "$snapshot"

    log "Verifying snapshot integrity"
    local check
    check="$(sqlite_integrity_check "$snapshot")"
    [[ "$check" == "ok" ]] || die "integrity_check failed on the snapshot, aborting before upload: $check"

    log "Uploading snapshot to the restic repository"
    "$RESTIC" backup --stdin --stdin-filename reflex.db --tag "$BACKUP_TAG" --host "$BACKUP_HOST" < "$snapshot"

    log "Applying retention policy (keep-daily=$KEEP_DAILY keep-weekly=$KEEP_WEEKLY keep-monthly=$KEEP_MONTHLY, prune)"
    "$RESTIC" forget --tag "$BACKUP_TAG" --host "$BACKUP_HOST" \
        --keep-daily "$KEEP_DAILY" --keep-weekly "$KEEP_WEEKLY" --keep-monthly "$KEEP_MONTHLY" --prune

    log "Backup completed"
}

do_restore_test() {
    WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/reflex-db-restore-test.XXXXXX")"
    local restore_dir="$WORK_DIR/restore"
    mkdir -p "$restore_dir"

    # A restorable but stale snapshot means the nightly job has been failing.
    local age_hours
    age_hours="$("$RESTIC" snapshots latest --tag "$BACKUP_TAG" --host "$BACKUP_HOST" --json | "$PYTHON3" -c '
import datetime, json, re, sys
snaps = json.load(sys.stdin)
if not snaps:
    sys.exit("no snapshot found")
# restic emits nanosecond fractions that fromisoformat rejects; drop them.
stamp = re.sub(r"\.\d+", "", snaps[-1]["time"]).replace("Z", "+00:00")
taken = datetime.datetime.fromisoformat(stamp)
print(int((datetime.datetime.now(datetime.timezone.utc) - taken).total_seconds() // 3600))
')" || die "could not read the latest snapshot"
    log "Latest snapshot is ${age_hours}h old (limit ${MAX_SNAPSHOT_AGE_HOURS}h)"
    (( age_hours <= MAX_SNAPSHOT_AGE_HOURS )) || die "latest snapshot is older than ${MAX_SNAPSHOT_AGE_HOURS}h; the scheduled backup is not running"

    log "Restoring the latest $BACKUP_TAG snapshot for a diagnostic check"
    "$RESTIC" restore latest --tag "$BACKUP_TAG" --host "$BACKUP_HOST" --target "$restore_dir"

    local restored_db
    restored_db="$(find "$restore_dir" -type f -name 'reflex.db' | head -n1)"
    [[ -n "$restored_db" ]] || restored_db="$(find "$restore_dir" -type f | head -n1)"
    [[ -n "$restored_db" && -f "$restored_db" ]] || die "restore produced no file to inspect in $restore_dir"

    log "Checking integrity of the restored copy"
    local check failed=0
    check="$(sqlite_integrity_check "$restored_db")"
    if [[ "$check" != "ok" ]]; then
        log "ERROR: integrity_check on the restored copy failed: $check"
        failed=1
    fi

    log "Comparing row counts: source ($REFLEX_DB) vs restored copy"
    printf '%-24s %12s %12s\n' "table" "source" "restored"
    local table src_count dst_count
    for table in "${USER_DATA_TABLES[@]}" "${DIAGNOSTIC_TABLES[@]}"; do
        src_count="$(sqlite_count "$REFLEX_DB" "$table" 2>/dev/null || echo "n/a")"
        dst_count="$(sqlite_count "$restored_db" "$table" 2>/dev/null || echo "n/a")"
        printf '%-24s %12s %12s\n' "$table" "$src_count" "$dst_count"
    done

    # The live DB keeps receiving form posts after the snapshot, so a count
    # difference is expected and only warned about. A user-data table that
    # has rows live but none in the restored copy means data is missing.
    for table in "${USER_DATA_TABLES[@]}"; do
        src_count="$(sqlite_count "$REFLEX_DB" "$table" 2>/dev/null || echo "n/a")"
        dst_count="$(sqlite_count "$restored_db" "$table" 2>/dev/null || echo "n/a")"
        if [[ "$dst_count" == "n/a" || ( "$dst_count" == "0" && "$src_count" != "0" ) ]]; then
            log "ERROR: user-data table '$table' is missing or empty in the restored copy: source=$src_count restored=$dst_count"
            failed=1
        elif [[ "$src_count" != "$dst_count" ]]; then
            log "WARNING: '$table' differs (source=$src_count restored=$dst_count); rows written after the snapshot are expected"
        fi
    done

    [[ "$failed" -eq 0 ]] || die "restore-test failed"
    log "restore-test passed: integrity ok, user data present in the restored copy"
}

main() {
    local cmd="${1:-backup}"
    load_config
    require_config
    acquire_lock
    case "$cmd" in
        backup) do_backup ;;
        restore-test) do_restore_test ;;
        *) die "unknown subcommand: $cmd (expected 'backup' or 'restore-test')" ;;
    esac
}

main "$@"

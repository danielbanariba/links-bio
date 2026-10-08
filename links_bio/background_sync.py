"""
Sync pipeline steps: YouTube -> DB, normalize, Astro build+deploy.

Each `run_*` function below is one pipeline step. `scripts/sync_and_deploy.py`
imports this module and calls them directly, once per cycle, run twice a day
by the links-bio-sync.{service,timer} systemd user units. There is no daemon
thread and no Reflex app here anymore: the in-app background-sync thread
that used to own this module (started from links_bio.py on every Reflex
boot) was removed once the Reflex UI itself was retired.

There used to be a DeathGrind-artwork sync step here too (run_artwork_sync);
it was removed because cdn.deathgrind.club sends
`Cross-Origin-Resource-Policy: same-site`, so every browser blocks those
cover images on this site regardless of what color/thumbnail processing
happens at build time. YouTube thumbnails are the cover source of truth now
(sync_youtube_to_db.py sets album_artwork_url from the video thumbnail on
every full sync); see "Data layer & sync" in CLAUDE.md.
"""

import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("background_sync")
logger.setLevel(logging.INFO)

# Cap on how long a `vercel whoami` preflight may hang before we give up
# instead of blocking the whole sync cycle on a network blip or a wedged
# CLI session.
_WHOAMI_TIMEOUT_SECONDS = 60


def _log(msg: str):
    """Log + print so the message reaches both pytest's caplog and the
    systemd unit's journal."""
    logger.warning(msg)
    print(f"[SYNC] {msg}", flush=True)


def _now() -> datetime:
    """Thin wrapper around the wall clock so tests can monkeypatch a fixed
    time instead of depending on when the suite happens to run -- the
    cadence in should_run_full_sync() needs a controllable `now`.

    Returns a tz-aware datetime in the system's local timezone (matching
    the systemd timer's OnCalendar=06:00/18:00, which schedules in local
    time), computed from an explicit UTC `now` rather than an implicit
    naive local clock.
    """
    return datetime.now(timezone.utc).astimezone()


def should_run_full_sync(album_count: int, now: datetime) -> bool:
    """Decide whether this cycle should run a full (not solo_nuevos) YouTube
    sync.

    Pure and stateless by design: `scripts/sync_and_deploy.py` runs as a
    fresh oneshot process twice a day (06:00 and 18:00, via the
    links-bio-sync.timer systemd unit), so an in-process counter -- the
    previous implementation -- always restarts at 1 and never reaches its
    "every 4th cycle" branch once the DB has >=100 albums, meaning the
    hole-filling full sync silently stopped running.

    A full sync runs when the DB is still nearly empty (fewer than 100
    albums), or on the morning run of every second day: two runs/day times
    "every other day" reproduces the original "every 4th cycle" cadence
    (roughly every 2 days) without needing to remember anything between
    runs.
    """
    if album_count < 100:
        return True
    return now.hour < 12 and now.toordinal() % 2 == 0


def run_youtube_sync(force_full: bool = False) -> None:
    """Authenticate with YouTube and run one sync pass (new videos -> DB,
    mark featured).

    This is one step of the pipeline `scripts/sync_and_deploy.py` runs
    directly; it raises on failure, and that caller decides what a failure
    means (logs it and keeps running the remaining steps).

    solo_nuevos is decided by should_run_full_sync(): full sync when the DB
    has fewer than 100 albums, or on the morning run of every second day (to
    fill holes left by incremental syncs), incremental otherwise. Pass
    force_full=True (wired to `scripts/sync_and_deploy.py --full-youtube-sync`)
    to force a full sync for a manual backfill regardless of that cadence.
    """
    from links_bio.youtube_auth import authenticate_auto
    youtube_client = authenticate_auto()

    # Importar aqui para evitar imports circulares
    import sys
    from pathlib import Path
    from sqlmodel import Session, select, func
    from links_bio.db import engine
    from links_bio.models.album import Album
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from sync_youtube_to_db import run_sync

    # Si la DB tiene pocos albums, hacer sync completo para llenar huecos
    with Session(engine) as session:
        album_count = session.exec(select(func.count(Album.id))).one()

    now = _now()
    full_sync = force_full or should_run_full_sync(album_count, now)
    solo_nuevos = not full_sync

    if force_full:
        _log(f"DB tiene {album_count} albums. --full-youtube-sync: forzando sync completo.")
    elif full_sync:
        _log(f"DB tiene {album_count} albums. Ejecutando sync completo ({now:%Y-%m-%d %H:%M}).")
    else:
        _log(f"DB tiene {album_count} albums. Ejecutando sync incremental ({now:%Y-%m-%d %H:%M}).")

    run_sync(
        youtube_client=youtube_client,
        solo_nuevos=solo_nuevos,
        mark_featured=True,
        featured_count=10,
    )


def find_node_bin():
    """Locate the nvm bin dir that holds npm/vercel (highest version first).

    The reflex process PATH is env/bin:/usr/local/bin:/usr/bin:/bin — it does NOT
    include nvm's bin, so a bare subprocess(["npm", ...]) raises FileNotFoundError.
    We resolve it ourselves instead of hardcoding a version so a node upgrade
    doesn't silently break the deploy again.
    """
    import glob
    import re

    def _ver(path: str):
        m = re.search(r"/v(\d+)\.(\d+)\.(\d+)/", path)
        return tuple(int(x) for x in m.groups()) if m else (0, 0, 0)

    candidates = glob.glob(os.path.expanduser("~/.local/share/nvm/v*/bin"))
    for d in sorted(candidates, key=_ver, reverse=True):
        if os.path.exists(os.path.join(d, "vercel")) and os.path.exists(os.path.join(d, "npm")):
            return d
    return None


def _masked_cmd(cmd: list) -> str:
    """Render a subprocess argv list for logging with any `--token` value
    redacted. Never used to build the real argv passed to subprocess.run --
    only for what gets printed/logged."""
    parts = list(cmd)
    for i, part in enumerate(parts):
        if part == "--token" and i + 1 < len(parts):
            parts[i + 1] = "****"
    return " ".join(parts)


def _run_vercel(cmd: list, cwd: str, env: dict, timeout: float | None = None):
    """Run a `vercel` subcommand via Popen, streaming its combined
    stdout+stderr to our own stdout line by line as each one arrives --
    so a hung upload, or a unit killed by its own systemd timeout, still
    leaves something in the journal/OnFailure email instead of nothing
    (a plain `subprocess.run(capture_output=True)` buffers everything
    until the process exits). The same lines are accumulated and
    returned so the caller can inspect them (e.g. for "not authorized").

    Shared by `_vercel_whoami` and `deploy_to_vercel` so this capture-
    and-echo logic isn't duplicated between them.

    When `timeout` is given and elapses before the process exits, it is
    killed and `subprocess.TimeoutExpired` is raised (carrying whatever
    output had streamed so far). Otherwise returns (returncode, output).
    """
    import subprocess
    import threading

    proc = subprocess.Popen(
        cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )

    timed_out = threading.Event()
    watchdog = None
    if timeout is not None:
        def _kill_on_timeout():
            timed_out.set()
            proc.kill()

        watchdog = threading.Timer(timeout, _kill_on_timeout)
        watchdog.daemon = True
        watchdog.start()

    lines = []
    try:
        for line in proc.stdout:
            print(line, end="", flush=True)
            lines.append(line)
    finally:
        if watchdog is not None:
            watchdog.cancel()

    proc.wait()
    output = "".join(lines)
    if timed_out.is_set():
        # TimeoutExpired renders its cmd into its message: pass the masked
        # form so `--token <value>` can never reach a log or traceback.
        raise subprocess.TimeoutExpired(_masked_cmd(cmd), timeout, output=output)
    return proc.returncode, output


def _whoami_failure_hint(token: str | None) -> str:
    """The actionable half of a `vercel whoami` failure message, shared
    between a nonzero exit and a timeout. Deliberately conditional ("if
    the CLI output above says...") instead of asserting the token was
    rejected: a network blip or a Vercel 5xx would otherwise send someone
    to rotate a perfectly good token. Never contains the token itself."""
    if token:
        return (
            " If the CLI output above says Not authorized, rotate "
            "VERCEL_TOKEN in .env (decision D2)."
        )
    return (
        " If the CLI output above says Not authorized, run `vercel "
        "login` on the host, or set VERCEL_TOKEN in .env (decision D2)."
    )


def _vercel_whoami(env: dict, web_dir, token: str | None) -> None:
    """Run `vercel whoami` with the same env, cwd and auth argv
    `deploy_to_vercel` is about to use, capped at
    _WHOAMI_TIMEOUT_SECONDS.

    This both confirms the session is authorized before the long upload
    starts, and gives an expiring Vercel CLI session a chance to refresh
    itself outside the deploy request's own window -- see
    `deploy_to_vercel`'s docstring for the 2026-10-07 incident this closes.

    Raises RuntimeError, never containing the token, on a nonzero exit or
    a timeout; callers must not deploy after that.
    """
    import subprocess

    whoami_cmd = ["vercel", "whoami"]
    if token:
        whoami_cmd += ["--token", token]

    _log(f"Verificando sesion de Vercel: {_masked_cmd(whoami_cmd)}")
    try:
        returncode, _output = _run_vercel(
            whoami_cmd, cwd=str(web_dir), env=env, timeout=_WHOAMI_TIMEOUT_SECONDS
        )
    except subprocess.TimeoutExpired:
        # `from None`: never chain the TimeoutExpired, whose message carries
        # the whoami argv, into the traceback sync_and_deploy logs.
        raise RuntimeError(
            f"vercel whoami timed out after {_WHOAMI_TIMEOUT_SECONDS}s."
            + _whoami_failure_hint(token)
        ) from None
    if returncode == 0:
        return
    raise RuntimeError(
        f"vercel whoami failed (exit {returncode})." + _whoami_failure_hint(token)
    )


def build_astro_site(env: dict) -> None:
    """Run `npm run build` for the Astro site. `env` must already have PATH
    pointing at the resolved node/npm bin dir (see find_node_bin()). Raises
    on failure (subprocess.run(check=True))."""
    import subprocess
    from pathlib import Path

    web_dir = Path(__file__).resolve().parent.parent / "web"
    _log("Rebuild del sitio Astro...")
    subprocess.run(["npm", "run", "build"], cwd=str(web_dir), check=True, env=env)


def deploy_to_vercel(env: dict) -> None:
    """Run `vercel deploy` for the already-built Astro site.

    Uses VERCEL_TOKEN when set (decision D2: unattended deploy via a token
    that lives in .env, instead of a logged-in CLI session that can expire
    silently -- which is exactly what has been happening since mid-
    September). Falls back to the logged-in Vercel CLI session otherwise,
    exactly like .git/hooks/pre-push, and logs a warning that D2 wants
    VERCEL_TOKEN set instead. --archive=tgz matches that working pre-push
    hook (the previous divergence here was flagged separately from the
    "Not authorized" failures, but it's still the right flag to match).

    Before deploying, runs `vercel whoami` (see _vercel_whoami) with the
    same env/cwd/auth argv. This closes the 2026-10-07 incident where the
    CLI's auth.json was rewritten mid-deploy -- a session-token refresh --
    and the in-flight `vercel deploy` was rejected with "Not authorized":
    the preflight lets that refresh happen before the long upload starts
    instead of during it. If the deploy still fails with "Not authorized"
    (case-insensitive) in its output, whoami is re-checked and the deploy
    is retried exactly once; any other failure, or a second failure after
    the retry, raises immediately with no further retry.

    The token is passed as a real argv element to the real subprocess, but
    is never written to this process's own logs or exceptions: every
    rendered command goes through `_masked_cmd`, and failure raises a
    RuntimeError instead of CalledProcessError, whose message would embed
    the raw argv (and end up in the journal and the OnFailure alert email).
    Both the whoami and deploy subprocesses run through the shared
    `_run_vercel` helper, which streams their output line by line as it
    arrives (instead of buffering it until exit) so a hung upload still
    leaves something in the journal/OnFailure email, while also handing
    back the accumulated text so it can be checked for "Not authorized".
    """
    from pathlib import Path

    web_dir = Path(__file__).resolve().parent.parent / "web"
    token = os.environ.get("VERCEL_TOKEN")
    if not token:
        _log(
            "VERCEL_TOKEN no esta configurado en .env: el deploy usara la "
            "sesion de la CLI de Vercel como fallback, que puede expirar en "
            "silencio. Configurar VERCEL_TOKEN es mas confiable (decision D2)."
        )

    deploy_cmd = ["vercel", "deploy", "--prod", "--prebuilt", "--yes", "--archive=tgz"]
    if token:
        deploy_cmd += ["--token", token]

    def _attempt_deploy():
        _log(f"Deploy a Vercel (prod): {_masked_cmd(deploy_cmd)}")
        return _run_vercel(deploy_cmd, cwd=str(web_dir), env=env)

    _vercel_whoami(env, web_dir, token)

    returncode, output = _attempt_deploy()
    if returncode != 0:
        if "not authorized" in output.lower():
            _log(
                "vercel deploy fallo con 'Not authorized'; re-verificando "
                "sesion y reintentando una vez."
            )
            _vercel_whoami(env, web_dir, token)
            returncode, output = _attempt_deploy()
        if returncode != 0:
            raise RuntimeError(
                f"vercel deploy failed with exit code {returncode}: "
                f"{_masked_cmd(deploy_cmd)}"
            )
    _log("Deploy Astro completado.")


def run_astro_build_and_deploy(skip_deploy: bool = False) -> None:
    """Rebuild the Astro static site from the updated DB and, unless
    skip_deploy, deploy it to Vercel. Raises on any failure (missing web/,
    missing npm/vercel, a failing build, or a failing deploy) -- callers
    decide whether that's fatal (the daemon thread below logs and
    continues; sync_and_deploy.py treats it as a failed step)."""
    from pathlib import Path

    web_dir = Path(__file__).resolve().parent.parent / "web"
    if not web_dir.exists():
        raise RuntimeError(f"web/ directory not found at {web_dir}")

    node_bin = find_node_bin()
    if not node_bin:
        raise RuntimeError("npm/vercel not found under ~/.local/share/nvm/v*/bin")

    # Prepend nvm's bin so npm, node, npx AND vercel all resolve in the subprocess.
    env = dict(os.environ)
    env["PATH"] = node_bin + os.pathsep + env.get("PATH", "")

    build_astro_site(env)

    if skip_deploy:
        _log("skip_deploy: build completado, deploy omitido.")
        return

    deploy_to_vercel(env)


def run_normalize():
    """Normaliza generos y paises en la DB."""
    from sqlmodel import Session, select
    from links_bio.db import engine
    from links_bio.models.album import Album
    from scripts.normalize_db import normalize_genre, normalize_country

    changes = 0
    with Session(engine) as session:
        albums = session.exec(select(Album)).all()
        for album in albums:
            new_genre = normalize_genre(album.genre)
            new_country = normalize_country(album.country)
            changed = False
            if new_genre != album.genre:
                album.genre = new_genre
                changed = True
            if new_country != album.country:
                album.country = new_country
                changed = True
            if changed:
                session.add(album)
                changes += 1
        if changes:
            session.commit()
    _log(f"Normalizacion: {changes} albums actualizados.")

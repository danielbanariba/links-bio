> **Write for the reviewer.** The description should read in one minute: what changes, why,
> and what to look at closely. No tables, no decorative sections, no repeating what the diff
> already shows. If it doesn't fit in a few lines, the PR is too big: split it.
> The technical detail belongs in the issue or the commit message.
>
> **A diagram when it explains better than text.** For flows, execution order, or
> relationships between components, a diagram replaces paragraphs: include it instead of
> describing them in prose, not in addition to.

## 📝 Description
<!-- Summary of the changes, following the commit template format -->
<!-- Example: :sparkles: feat(forms): add rate limiting to the submit endpoint -->

**Detailed context:**
<!-- What changes and why, in a few lines. Mention linked issues (Closes #123) -->

---

## 🧪 Verification Checklist
- [ ] **Python lint**: `ruff check links_bio/` passes with no new findings.
- [ ] **Python tests**: the pytest suite passes (`uv run --with pytest --python env/bin/python -m pytest tests -q`).
- [ ] **Frontend tests**: `cd web && npm test` passes.
- [ ] **Frontend build**: `cd web && npm run build` succeeds.
- [ ] **Migrations**: if `links_bio/models/` changed, an Alembic migration was added (`alembic revision --autogenerate`).
- [ ] **Secrets/PII**: no secrets or personal data in the diff (`reflex.db` is production data).
- [ ] **Production impact**: pushing `main` deploys production — confirmed this is intended, or deferred to a feature branch.

---

## 📸 Attachments (Optional)
<!-- Screenshots, build output, or logs if relevant -->

"""Contract tests pinning each Astro form page's JSON POST payload to the
FastAPI request model it actually talks to (T27).

web/src/pages/index.astro's contact form (lines ~221-253) sends
{name, email, subject, message, website} -- every named input in its
<form>, built via `Object.fromEntries(new FormData(form))` (line ~285) --
but links_bio.fastapi_forms.ContactRequest required
{nombre, email, asunto, mensaje, website} instead. EVERY real contact
submission has returned 422 since 2026-05-21, when the English-labelled
form shipped (d3668e9). This file builds each of the 4 Astro pages'
payloads the same way that page's own script builds them, verified
against the page's current source rather than hand-maintained guesses, and
POSTs them to the real FastAPI app -- so a future drift between a page's
fields and its request model fails a test here instead of silently
422-ing in production again.

Was RED for /contact (422, no row stored) against the unfixed
ContactRequest; GREEN (200, row stored) after T27's field rename.
"""
from __future__ import annotations

import re
from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from links_bio.models.contact_message import ContactMessage
from links_bio.models.newsletter import NewsletterSubscriber
from links_bio.models.submission import Submission

REPO_ROOT = Path(__file__).resolve().parent.parent
PAGES_DIR = REPO_ROOT / "web" / "src" / "pages"

INDEX_ASTRO = PAGES_DIR / "index.astro"
SUBMIT_ASTRO = PAGES_DIR / "metal-archive" / "submit.astro"
PROMO_ASTRO = PAGES_DIR / "metal-archive" / "promo.astro"
NEWSLETTER_ASTRO = PAGES_DIR / "metal-archive" / "newsletter.astro"


# ─── Static parsing of each page's <form>, so a changed page breaks this
# test instead of the hardcoded payload silently going stale ──────────────


def _form_block(source: str, form_id: str) -> str:
    """Return the `<form id="form_id">...</form>` substring of `source`."""
    start = re.search(rf'<form\b[^>]*\bid="{form_id}"[^>]*>', source)
    assert start, f'no <form id="{form_id}"> found in page source'
    end = source.index("</form>", start.end())
    return source[start.end() : end]


def _drop_disabled_conditionals(block: str, source: str) -> str:
    """Strip a `{CONST && ( ... )}` block whose frontmatter `const CONST =`
    is currently `false` -- Astro never renders it, so a field inside (e.g.
    promo.astro's PACKAGES_READY-gated `release_format` select) is never
    actually present in the DOM or sent by the page's script. Finds the
    block's balanced closing `)}` rather than assuming no nested parens.
    """
    for m in re.finditer(r"\{(\w+)\s*&&\s*\(", block):
        const_def = re.search(rf"const\s+{m.group(1)}\s*=\s*(true|false)\s*;", source)
        if not const_def or const_def.group(1) != "false":
            continue
        depth = 0
        start_paren = m.end() - 1
        for j in range(start_paren, len(block)):
            if block[j] == "(":
                depth += 1
            elif block[j] == ")":
                depth -= 1
                if depth == 0:
                    end = j + 2 if block[j + 1 : j + 2] == "}" else j + 1
                    block = block[: m.start()] + block[end:]
                    break
    return block


def _static_field_names(path: Path, form_id: str) -> set[str]:
    """The statically-named `name="..."` attributes this page's form
    actually renders at initial page load.

    Excludes a dynamically-templated name (promo.astro's JS-inserted
    `name="extra_link_${idx}"` rows -- a literal `${idx}` never matches
    the quoted-literal regex below, and no such row exists until a
    visitor clicks "+ Add another link") and any field gated behind a
    frontmatter constant that is currently `false`.
    """
    source = path.read_text()
    block = _drop_disabled_conditionals(_form_block(source, form_id), source)
    return set(re.findall(r'\bname="([a-zA-Z0-9_]+)"', block))


# ─── DB lookups, scoped to this test's own distinguishing email so a
# scratch DB pre-seeded with real rows (it's a copy of the dev DB) can't
# produce a false pass ──────────────────────────────────────────────────


def _submission(engine, email: str) -> Submission | None:
    with Session(engine) as session:
        return session.exec(
            select(Submission).where(Submission.contact_email == email)
        ).first()


def _contact_message(engine, email: str) -> ContactMessage | None:
    with Session(engine) as session:
        return session.exec(
            select(ContactMessage).where(ContactMessage.email == email)
        ).first()


def _newsletter_subscriber(engine, email: str) -> NewsletterSubscriber | None:
    with Session(engine) as session:
        return session.exec(
            select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)
        ).first()


# ─── Contract tests, one per page ──────────────────────────────────────────


def test_contact_page_payload_is_accepted_and_stored(forms_client: TestClient) -> None:
    """index.astro's #contact-form sends every named input via FormData
    (name, email, subject, message, website) straight as JSON. This is
    the exact T27 defect: ContactRequest required nombre/asunto/mensaje
    instead, so this payload shape 422'd on every real submission.
    """
    keys = _static_field_names(INDEX_ASTRO, "contact-form")
    assert keys == {"name", "email", "subject", "message", "website"}
    assert "website" in keys  # the honeypot must actually be in the payload

    email = "t27-contact-contract@example.com"
    payload = {
        "name": "T27 Contract Test",
        "email": email,
        "subject": "Contract check",
        "message": "Does the contact form still work end to end?",
        "website": "",
    }
    assert set(payload) == keys

    res = forms_client.post("/api/metal-archive/contact", json=payload)

    assert res.status_code == 200, res.text
    stored = _contact_message(forms_client.db_engine, email)  # type: ignore[attr-defined]
    assert stored is not None
    assert stored.name == "T27 Contract Test"
    assert stored.message == "Does the contact form still work end to end?"


def test_submit_page_payload_is_accepted_and_stored(forms_client: TestClient) -> None:
    """submit.astro's #submit-form sends every named input via FormData
    (band_name, contact_email, genre, country, album_title, year,
    youtube_url, bandcamp_url, description, website) straight as JSON.
    """
    keys = _static_field_names(SUBMIT_ASTRO, "submit-form")
    assert keys == {
        "band_name", "contact_email", "genre", "country", "album_title",
        "year", "youtube_url", "bandcamp_url", "description", "website",
    }
    assert "website" in keys

    email = "t27-submit-contract@example.com"
    payload = {
        "band_name": "T27 Contract Band",
        "contact_email": email,
        "genre": "Death Metal",
        "country": "Honduras",
        "album_title": "Contract Album",
        "year": "2026",
        "youtube_url": "https://youtu.be/t27-contract",
        "bandcamp_url": "",
        "description": "",
        "website": "",
    }
    assert set(payload) == keys

    res = forms_client.post("/api/metal-archive/submit", json=payload)

    assert res.status_code == 200, res.text
    stored = _submission(forms_client.db_engine, email)  # type: ignore[attr-defined]
    assert stored is not None
    assert stored.band_name == "T27 Contract Band"


def test_promo_page_payload_is_accepted_and_stored(forms_client: TestClient) -> None:
    """promo.astro's #promo-form builds its payload field-by-field from
    FormData (`fd.forEach`) over whatever the form currently renders. At
    initial load that is band_name, email, genre, custom_genre, country,
    album_title, year, youtube_url, bandcamp_url, website -- NOT
    release_format (gated behind `PACKAGES_READY = false`) and NOT any
    extra_link_N row (only added once a visitor clicks "+ Add another
    link").
    """
    keys = _static_field_names(PROMO_ASTRO, "promo-form")
    assert keys == {
        "band_name", "email", "genre", "custom_genre", "country",
        "album_title", "year", "youtube_url", "bandcamp_url", "website",
    }
    assert "website" in keys
    assert "release_format" not in keys  # PACKAGES_READY is false today

    email = "t27-promo-contract@example.com"
    payload = {
        "band_name": "T27 Contract Promo Band",
        "email": email,
        "genre": "Death Metal",
        "custom_genre": "",
        "country": "Honduras",
        "album_title": "Contract Promo Album",
        "year": "2026",
        "youtube_url": "https://youtu.be/t27-promo-contract",
        "bandcamp_url": "",
        "website": "",
    }
    assert set(payload) == keys

    res = forms_client.post("/api/metal-archive/promo", json=payload)

    assert res.status_code == 200, res.text
    stored = _contact_message(forms_client.db_engine, email)  # type: ignore[attr-defined]
    assert stored is not None
    assert stored.name == "T27 Contract Promo Band"


def test_newsletter_page_payload_is_accepted_and_stored(forms_client: TestClient) -> None:
    """newsletter.astro does NOT use FormData: its script explicitly reads
    just #email and #website (lines ~105-109) and POSTs exactly
    `{ email, website }` (line ~123). Both names are still cross-checked
    against the form's own static `name="..."` attributes below so a
    renamed input would still break this test.
    """
    form_fields = _static_field_names(NEWSLETTER_ASTRO, "newsletter-form")
    explicit_keys = {"email", "website"}
    assert explicit_keys <= form_fields
    assert "website" in explicit_keys

    email = "t27-newsletter-contract@example.com"
    payload = {"email": email, "website": ""}

    res = forms_client.post("/api/metal-archive/newsletter", json=payload)

    assert res.status_code == 200, res.text
    stored = _newsletter_subscriber(forms_client.db_engine, email)  # type: ignore[attr-defined]
    assert stored is not None

"""
FastAPI micro-service for Metal Archive form submissions.

Runs alongside (not inside) the Reflex app.
Start with:
    uvicorn links_bio.fastapi_forms:app --port 8001

Writes to the same reflex.db used by Reflex; reuses _send_email_notification
from form_state.py.
"""
import os
import logging
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, field_validator
from sqlmodel import Session, create_engine, select

from links_bio.models.submission import Submission
from links_bio.models.newsletter import NewsletterSubscriber
from links_bio.models.contact_message import ContactMessage
from links_bio.states.form_state import _send_email_notification

# ─── DB setup ────────────────────────────────────────────────────────────────
# Mirrors rxconfig.py: db_url = "sqlite:///reflex.db"
# The path is relative to cwd when uvicorn runs (project root).
DB_URL = os.environ.get("REFLEX_DB_URL", "sqlite:///reflex.db")
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})

logger = logging.getLogger("fastapi_forms")
logging.basicConfig(level=logging.INFO)

# ─── App + CORS ──────────────────────────────────────────────────────────────
app = FastAPI(title="Metal Archive Forms API", version="1.0.0")

ALLOWED_ORIGINS = [
    "https://danielbanariba.com",
    "https://www.danielbanariba.com",
    "http://localhost:3000",
    "http://localhost:4321",   # Astro dev server
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4321",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# ─── Pydantic request bodies ─────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    band_name: str
    contact_email: str
    genre: str
    country: str
    album_title: str = ""
    year: str = ""
    youtube_url: str = ""
    bandcamp_url: str = ""
    description: str = ""

    @field_validator("band_name", "contact_email", "genre", "country", mode="before")
    @classmethod
    def must_not_be_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Este campo es obligatorio")
        return v.strip()


class PromoRequest(BaseModel):
    band_name: str
    email: str
    album_title: str
    genre: str = ""
    custom_genre: str = ""
    country: str = ""
    year: str = ""
    release_format: str = ""
    youtube_url: str = ""
    bandcamp_url: str = ""
    # Extra links: up to 5, sent as extra_link_0 … extra_link_4
    extra_link_0: str = ""
    extra_link_1: str = ""
    extra_link_2: str = ""
    extra_link_3: str = ""
    extra_link_4: str = ""

    @field_validator("band_name", "email", "album_title", mode="before")
    @classmethod
    def must_not_be_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Este campo es obligatorio")
        return v.strip()


class NewsletterRequest(BaseModel):
    email: str

    @field_validator("email", mode="before")
    @classmethod
    def must_be_valid_email(cls, v: str) -> str:
        if not v or "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Email invalido")
        return v.strip().lower()


class ContactRequest(BaseModel):
    nombre: str
    email: str
    asunto: str = ""
    mensaje: str

    @field_validator("nombre", "email", "mensaje", mode="before")
    @classmethod
    def must_not_be_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Este campo es obligatorio")
        return v.strip()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _db_session() -> Session:
    return Session(engine)


def _http_error(detail: str, status: int = 400) -> HTTPException:
    raise HTTPException(status_code=status, detail=detail)


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.post("/api/metal-archive/submit")
async def submit_band(req: SubmitRequest):
    """Save a band submission to reflex.db."""
    try:
        with _db_session() as session:
            submission = Submission(
                band_name=req.band_name,
                contact_email=req.contact_email,
                genre=req.genre,
                country=req.country,
                album_title=req.album_title.strip(),
                youtube_url=req.youtube_url.strip(),
                bandcamp_url=req.bandcamp_url.strip(),
                description=req.description.strip(),
            )
            session.add(submission)
            session.commit()
            logger.info(f"Submission saved: {req.band_name}")
    except Exception as exc:
        logger.error(f"DB error on submit: {exc}")
        raise HTTPException(status_code=500, detail="Error al guardar. Intentalo de nuevo.")

    return {"ok": True, "message": "Banda enviada correctamente. Revisaremos tu envio pronto."}


@app.post("/api/metal-archive/promo")
async def promo_band(req: PromoRequest):
    """Save a promo request + send email notification."""
    # Genre: custom wins over dropdown selection
    genre = req.custom_genre.strip() or req.genre.strip()
    if not genre:
        raise HTTPException(status_code=400, detail="Selecciona un genero.")

    # Collect all provided links
    links = []
    for url in [req.youtube_url, req.bandcamp_url]:
        if url.strip():
            links.append(url.strip())
    for extra in [req.extra_link_0, req.extra_link_1, req.extra_link_2,
                  req.extra_link_3, req.extra_link_4]:
        if extra.strip():
            links.append(extra.strip())

    if not links:
        raise HTTPException(status_code=400, detail="Agrega al menos un link.")

    # Save to DB (reusing ContactMessage — same pattern as form_state.handle_contact_form)
    try:
        with _db_session() as session:
            contact = ContactMessage(
                name=req.band_name,
                email=req.email,
                company=genre,
                message=req.album_title,
                package_interest=req.release_format.strip(),
            )
            session.add(contact)
            session.commit()
            logger.info(f"Promo saved: {req.band_name} - {req.album_title}")
    except Exception as exc:
        logger.error(f"DB error on promo: {exc}")
        raise HTTPException(status_code=500, detail="Error al guardar. Intentalo de nuevo.")

    # Send email notification — reuse _send_email_notification from form_state.py
    links_text = "\n".join(f"  - {l}" for l in links)
    email_body = (
        f"Nueva solicitud de subida al Metal Archive\n"
        f"{'=' * 50}\n\n"
        f"Banda: {req.band_name}\n"
        f"Email: {req.email}\n"
        f"Genero: {genre}\n"
        f"Pais: {req.country or '(no indicado)'}\n"
        f"Ano: {req.year or '(no indicado)'}\n"
        f"Formato: {req.release_format or '(no indicado)'}\n"
        f"Album: {req.album_title}\n\n"
        f"Links:\n{links_text}\n"
    )
    err = _send_email_notification(
        subject=f"Metal Archive: {req.band_name} - {req.album_title}",
        body=email_body,
    )
    if err:
        logger.warning(f"Email not sent (non-fatal): {err}")

    return {"ok": True, "message": "Solicitud recibida. Te contactaremos pronto."}


@app.post("/api/metal-archive/newsletter")
async def newsletter_signup(req: NewsletterRequest):
    """Subscribe an email to the newsletter. Rejects duplicates."""
    try:
        with _db_session() as session:
            existing = session.exec(
                select(NewsletterSubscriber).where(
                    NewsletterSubscriber.email == req.email
                )
            ).first()
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail="Este email ya esta suscrito."
                )

            subscriber = NewsletterSubscriber(email=req.email)
            session.add(subscriber)
            session.commit()
            logger.info(f"Newsletter signup: {req.email}")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"DB error on newsletter: {exc}")
        raise HTTPException(status_code=500, detail="Error al suscribir. Intentalo de nuevo.")

    return {"ok": True, "message": "Suscripcion exitosa. Bienvenido al archivo."}


@app.post("/api/metal-archive/contact")
async def contact(req: ContactRequest):
    """Portfolio contact form: save + send email notification."""
    try:
        with _db_session() as session:
            msg = ContactMessage(
                name=req.nombre,
                email=req.email,
                company=req.asunto,
                message=req.mensaje,
                package_interest="portfolio",
            )
            session.add(msg)
            session.commit()
            logger.info(f"Contact message saved: {req.nombre} <{req.email}>")
    except Exception as exc:
        logger.error(f"DB error on contact: {exc}")
        raise HTTPException(status_code=500, detail="Error al enviar. Intentalo de nuevo.")

    email_body = (
        f"Nuevo mensaje de contacto desde el portfolio\n"
        f"{'=' * 50}\n\n"
        f"Nombre: {req.nombre}\n"
        f"Email: {req.email}\n"
        f"Asunto: {req.asunto or '(sin asunto)'}\n\n"
        f"Mensaje:\n{req.mensaje}\n"
    )
    err = _send_email_notification(
        subject=f"Portfolio: mensaje de {req.nombre}",
        body=email_body,
    )
    if err:
        logger.warning(f"Email not sent (non-fatal): {err}")

    return {"ok": True, "message": "Message sent! I'll get back to you soon."}

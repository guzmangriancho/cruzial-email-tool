from __future__ import annotations

import os
import smtplib
import socket
from dataclasses import dataclass
from datetime import datetime
from email.utils import parseaddr

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.repositories import organizacion_smtp_repository as repo
from backend.schemas.organizacion_smtp import SmtpConfigPayload, SmtpConfigStatusResponse, SmtpTestResponse
from backend.utils.secret_box import decrypt_secret, encrypt_secret

SMTP_TIMEOUT_SECONDS = float(os.getenv("SMTP_TEST_TIMEOUT_SECONDS", "8"))
LOCAL_ORGANIZATION_ID = 1


@dataclass(frozen=True)
class SmtpSendSettings:
    host: str
    port: int
    security: str
    username: str
    password: str
    from_email: str
    from_name: str | None = None
    reply_to: str | None = None


@dataclass(frozen=True)
class SmtpCandidate:
    host: str
    port: int
    security: str


def _normalize_email(value: str) -> str:
    email = (value or "").strip().lower()
    parsed = parseaddr(email)[1].lower()
    if not parsed or "@" not in parsed:
        raise HTTPException(status_code=422, detail="Introduce un email SMTP válido.")
    return parsed


def _normalize_security(value: str | None, port: int | None = None) -> str:
    raw = (value or "").strip().lower()
    if raw in {"starttls", "tls"} or port == 587:
        return "starttls"
    return "ssl"


def _provider_candidates(domain: str) -> list[SmtpCandidate]:
    common: dict[str, list[SmtpCandidate]] = {
        "gmail.com": [SmtpCandidate("smtp.gmail.com", 465, "ssl"), SmtpCandidate("smtp.gmail.com", 587, "starttls")],
        "googlemail.com": [SmtpCandidate("smtp.gmail.com", 465, "ssl"), SmtpCandidate("smtp.gmail.com", 587, "starttls")],
        "outlook.com": [SmtpCandidate("smtp.office365.com", 587, "starttls")],
        "hotmail.com": [SmtpCandidate("smtp.office365.com", 587, "starttls")],
        "live.com": [SmtpCandidate("smtp.office365.com", 587, "starttls")],
        "icloud.com": [SmtpCandidate("smtp.mail.me.com", 587, "starttls")],
        "yahoo.com": [SmtpCandidate("smtp.mail.yahoo.com", 465, "ssl"), SmtpCandidate("smtp.mail.yahoo.com", 587, "starttls")],
    }
    return common.get(domain, [])


def build_candidates(username: str, payload: SmtpConfigPayload) -> list[SmtpCandidate]:
    candidates: list[SmtpCandidate] = []
    seen: set[tuple[str, int, str]] = set()

    def add(host: str | None, port: int | None, security: str | None = None):
        host = (host or "").strip().lower()
        if not host:
            return
        resolved_port = int(port or 465)
        resolved_security = _normalize_security(security, resolved_port)
        key = (host, resolved_port, resolved_security)
        if key not in seen:
            candidates.append(SmtpCandidate(host, resolved_port, resolved_security))
            seen.add(key)

    if payload.smtp_host:
        add(payload.smtp_host, payload.smtp_port or 465, payload.smtp_security)

    if payload.auto_discover:
        domain = username.rsplit("@", 1)[1].lower()
        for candidate in _provider_candidates(domain):
            add(candidate.host, candidate.port, candidate.security)
        for host in (f"mail.{domain}", f"smtp.{domain}", domain):
            add(host, 465, "ssl")
            add(host, 587, "starttls")

    return candidates


def test_smtp_login(candidate: SmtpCandidate, username: str, password: str) -> SmtpTestResponse:
    try:
        if candidate.security == "ssl":
            with smtplib.SMTP_SSL(candidate.host, candidate.port, timeout=SMTP_TIMEOUT_SECONDS) as server:
                server.login(username, password)
        else:
            with smtplib.SMTP(candidate.host, candidate.port, timeout=SMTP_TIMEOUT_SECONDS) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(username, password)
        return SmtpTestResponse(
            ok=True,
            message="Conexión SMTP validada correctamente.",
            smtp_host=candidate.host,
            smtp_port=candidate.port,
            smtp_security=candidate.security,
        )
    except smtplib.SMTPAuthenticationError:
        return SmtpTestResponse(ok=False, message=f"El servidor rechazó las credenciales en {candidate.host}:{candidate.port}.")
    except (socket.timeout, TimeoutError):
        return SmtpTestResponse(ok=False, message=f"Tiempo de espera agotado en {candidate.host}:{candidate.port}.")
    except Exception as exc:
        # Mensaje acotado: no incluye contraseñas ni payloads.
        return SmtpTestResponse(ok=False, message=f"No se pudo conectar con {candidate.host}:{candidate.port}: {type(exc).__name__}.")


def discover_and_test(payload: SmtpConfigPayload) -> SmtpTestResponse:
    username = _normalize_email(payload.smtp_username)
    if not payload.smtp_password:
        raise HTTPException(status_code=422, detail="Introduce la contraseña SMTP.")
    candidates = build_candidates(username, payload)
    if not candidates:
        raise HTTPException(status_code=422, detail="Indica un host SMTP o activa la detección automática.")

    messages: list[str] = []
    for candidate in candidates:
        result = test_smtp_login(candidate, username, payload.smtp_password)
        if result.ok:
            return result
        messages.append(result.message)
    return SmtpTestResponse(ok=False, message=" ".join(messages[:3]))


def _credential_is_readable(config) -> bool:
    if not config or not config.smtp_password_encrypted:
        return False
    try:
        decrypt_secret(config.smtp_password_encrypted)
        return True
    except Exception:
        return False


def _to_status(config) -> SmtpConfigStatusResponse:
    if not config or not config.is_active:
        return SmtpConfigStatusResponse(configured=False, source="local", can_edit=True)

    readable = _credential_is_readable(config)
    return SmtpConfigStatusResponse(
        configured=bool(config.last_test_success and readable),
        source="local",
        smtp_host=config.smtp_host,
        smtp_port=config.smtp_port,
        smtp_security=config.smtp_security,
        smtp_username=config.smtp_username,
        from_email=config.from_email,
        from_name=config.from_name,
        reply_to=config.reply_to,
        last_test_success=bool(config.last_test_success and readable),
        last_test_at=config.last_test_at,
        last_test_error=(
            config.last_test_error
            if readable
            else (
                "No hay una contraseña SMTP válida guardada. Introdúcela y pulsa Probar y guardar."
                if not config.smtp_password_encrypted
                else "La contraseña guardada pertenece a una configuración anterior. Vuelve a introducirla y guarda."
            )
        ),
        can_edit=True,
    )


def get_status(db: Session) -> SmtpConfigStatusResponse:
    return _to_status(repo.get_by_organization_id(db, LOCAL_ORGANIZATION_ID))


def test_config(payload: SmtpConfigPayload) -> SmtpTestResponse:
    return discover_and_test(payload)


def save_config(payload: SmtpConfigPayload, db: Session) -> SmtpConfigStatusResponse:
    username = _normalize_email(payload.smtp_username)
    result = discover_and_test(payload)
    if not result.ok:
        raise HTTPException(status_code=422, detail=result.message)

    from_email = _normalize_email(payload.from_email or username)
    reply_to = _normalize_email(payload.reply_to) if payload.reply_to else None
    from_name = (payload.from_name or "Cruzial").strip() or "Cruzial"

    config = repo.upsert_config(
        db,
        organization_id=LOCAL_ORGANIZATION_ID,
        smtp_host=result.smtp_host or "",
        smtp_port=int(result.smtp_port or 465),
        smtp_security=result.smtp_security or "ssl",
        smtp_username=username,
        smtp_password_encrypted=encrypt_secret(payload.smtp_password),
        from_email=from_email,
        from_name=from_name,
        reply_to=reply_to,
        updated_by_user_id=None,
        last_test_success=True,
        last_test_at=datetime.utcnow(),
        last_test_error=None,
    )
    db.commit()
    db.refresh(config)
    return _to_status(config)


def delete_config(db: Session) -> dict:
    deleted = repo.delete_config(db, LOCAL_ORGANIZATION_ID)
    db.commit()
    return {"mensaje": "Configuración SMTP eliminada." if deleted else "No había configuración SMTP."}


def get_send_settings(db: Session, organization_id: int = LOCAL_ORGANIZATION_ID) -> SmtpSendSettings:
    config = repo.get_by_organization_id(db, LOCAL_ORGANIZATION_ID)
    if not config or not config.is_active or not config.last_test_success:
        raise HTTPException(status_code=409, detail="SMTP no configurado. Ábrelo en Configuración antes de enviar campañas.")
    try:
        password = decrypt_secret(config.smtp_password_encrypted)
    except Exception as exc:
        raise HTTPException(status_code=409, detail="La credencial SMTP debe volver a guardarse desde Configuración.") from exc
    return SmtpSendSettings(
        host=config.smtp_host,
        port=int(config.smtp_port),
        security=config.smtp_security,
        username=config.smtp_username,
        password=password,
        from_email=config.from_email or config.smtp_username,
        from_name=config.from_name,
        reply_to=config.reply_to,
    )

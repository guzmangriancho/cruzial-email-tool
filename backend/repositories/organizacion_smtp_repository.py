from __future__ import annotations

from sqlalchemy.orm import Session

from backend import models


def get_by_organization_id(db: Session, organization_id: int):
    return (
        db.query(models.OrganizacionSmtpConfig)
        .filter(models.OrganizacionSmtpConfig.organization_id == organization_id)
        .first()
    )


def upsert_config(
    db: Session,
    *,
    organization_id: int,
    smtp_host: str,
    smtp_port: int,
    smtp_security: str,
    smtp_username: str,
    smtp_password_encrypted: str,
    from_email: str,
    from_name: str | None,
    reply_to: str | None,
    updated_by_user_id: int | None,
    last_test_success: bool,
    last_test_at,
    last_test_error: str | None,
):
    config = get_by_organization_id(db, organization_id)
    if not config:
        config = models.OrganizacionSmtpConfig(organization_id=organization_id)
        db.add(config)

    config.smtp_host = smtp_host
    config.smtp_port = smtp_port
    config.smtp_security = smtp_security
    config.smtp_username = smtp_username
    config.smtp_password_encrypted = smtp_password_encrypted
    config.from_email = from_email
    config.from_name = from_name
    config.reply_to = reply_to
    config.is_active = True
    config.updated_by_user_id = updated_by_user_id
    config.last_test_success = last_test_success
    config.last_test_at = last_test_at
    config.last_test_error = last_test_error
    config.last_test_host = smtp_host
    config.last_test_port = smtp_port
    config.last_test_security = smtp_security
    return config


def delete_config(db: Session, organization_id: int) -> bool:
    config = get_by_organization_id(db, organization_id)
    if not config:
        return False
    db.delete(config)
    return True

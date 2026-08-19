from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def _key_material() -> str:
    secret = (os.getenv("SMTP_CREDENTIALS_SECRET_KEY") or "").strip()
    if len(secret) < 24:
        raise RuntimeError(
            "SMTP_CREDENTIALS_SECRET_KEY no está configurada o es demasiado corta. "
            "Revisa el archivo .env."
        )
    return secret


def _fernet() -> Fernet:
    digest = hashlib.sha256(_key_material().encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt((value or "").encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt((token or "").encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError(
            "No se pudo descifrar la contraseña SMTP. Comprueba que esta instalación "
            "usa la misma SMTP_CREDENTIALS_SECRET_KEY con la que se guardó."
        ) from exc

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def get_value(db: Session, key: str) -> str | None:
    return db.execute(
        text("SELECT valor FROM cruzial_local_settings WHERE clave = :clave"),
        {"clave": key},
    ).scalar_one_or_none()


def set_value(db: Session, key: str, value: str) -> None:
    db.execute(
        text(
            """
            INSERT INTO cruzial_local_settings (clave, valor, updated_at)
            VALUES (:clave, :valor, CURRENT_TIMESTAMP)
            ON CONFLICT(clave) DO UPDATE SET
                valor = excluded.valor,
                updated_at = CURRENT_TIMESTAMP
            """
        ),
        {"clave": key, "valor": value},
    )


def delete_value(db: Session, key: str) -> bool:
    result = db.execute(
        text("DELETE FROM cruzial_local_settings WHERE clave = :clave"),
        {"clave": key},
    )
    return bool(result.rowcount)

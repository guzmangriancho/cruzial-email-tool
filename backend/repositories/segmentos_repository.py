from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def execute(db: Session, statement: str, params: dict | None = None):
    return db.execute(text(statement), params or {})


def commit(db: Session) -> None:
    db.commit()

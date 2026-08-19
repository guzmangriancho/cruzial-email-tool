from __future__ import annotations

from typing import Generator

from fastapi import Request
from sqlalchemy.orm import Session

from backend.database import SessionLocal

LOCAL_ORGANIZATION_ID = 1


def get_db(_request: Request) -> Generator[Session, None, None]:
    db = SessionLocal()
    # Se conserva el tenant 1 solo para que la BBDD histórica siga siendo compatible.
    db.info["organization_id"] = LOCAL_ORGANIZATION_ID
    db.info["user_id"] = None
    try:
        yield db
    finally:
        db.close()

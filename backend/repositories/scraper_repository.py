from __future__ import annotations

from typing import Iterable, Optional

from sqlalchemy.orm import Session

from backend import models


def get_existing_url_maps(db: Session) -> set[str]:
    return {
        row[0]
        for row in db.query(models.Cliente.url_maps)
        .filter(models.Cliente.url_maps.isnot(None), models.Cliente.url_maps != "")
        .all()
    }


def find_cliente_by_email(db: Session, email: str) -> Optional[models.Cliente]:
    return db.query(models.Cliente).filter(models.Cliente.email == email).first()


def find_cliente_by_url_maps(db: Session, url_maps: str) -> Optional[models.Cliente]:
    return db.query(models.Cliente).filter(models.Cliente.url_maps == url_maps).first()


def find_cliente_by_sitio_web(db: Session, sitio_web: str) -> Optional[models.Cliente]:
    return db.query(models.Cliente).filter(models.Cliente.sitio_web == sitio_web).first()

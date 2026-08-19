from __future__ import annotations

from typing import Iterable, Optional

from sqlalchemy.orm import Session

from backend import models


def get_cliente_by_id(db: Session, cliente_id: int) -> Optional[models.Cliente]:
    return db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()


def get_cliente_by_email(db: Session, email: str) -> Optional[models.Cliente]:
    return db.query(models.Cliente).filter(models.Cliente.email == email).first()


def get_cliente_by_url_maps(db: Session, url_maps: str) -> Optional[models.Cliente]:
    return db.query(models.Cliente).filter(models.Cliente.url_maps == url_maps).first()


def get_cliente_by_sitio_web(db: Session, sitio_web: str) -> Optional[models.Cliente]:
    return db.query(models.Cliente).filter(models.Cliente.sitio_web == sitio_web).first()


def add_cliente(db: Session, cliente: models.Cliente) -> models.Cliente:
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def commit_refresh(db: Session, instance):
    db.commit()
    db.refresh(instance)
    return instance


def delete_cliente(db: Session, cliente: models.Cliente) -> None:
    db.delete(cliente)
    db.commit()


def delete_clientes_by_ids(db: Session, ids: Iterable[int]) -> int:
    ids = list(ids)
    if not ids:
        return 0
    eliminados = db.query(models.Cliente).filter(models.Cliente.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return int(eliminados or 0)


def get_cliente_by_public_id(db: Session, public_id: str, organization_id: int | None = None) -> Optional[models.Cliente]:
    query = db.query(models.Cliente).filter(models.Cliente.public_id == public_id)
    if organization_id is not None:
        query = query.filter(models.Cliente.organization_id == organization_id)
    return query.first()

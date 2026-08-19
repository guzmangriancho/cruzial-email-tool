from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from backend import models


def get_campana_by_id(db: Session, campana_id: int) -> Optional[models.Campana]:
    return db.query(models.Campana).filter(models.Campana.id == campana_id).first()


def get_plantilla_by_id(db: Session, plantilla_id: int) -> Optional[models.Plantilla]:
    return db.query(models.Plantilla).filter(models.Plantilla.id == plantilla_id).first()


def add_and_refresh(db: Session, instance):
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return instance


def commit_refresh(db: Session, instance):
    db.commit()
    db.refresh(instance)
    return instance


def delete_campana(db: Session, campana: models.Campana) -> None:
    db.delete(campana)
    db.commit()


def get_campana_by_public_id(db: Session, public_id: str, organization_id: int | None = None) -> Optional[models.Campana]:
    query = db.query(models.Campana).filter(models.Campana.public_id == public_id)
    if organization_id is not None:
        query = query.filter(models.Campana.organization_id == organization_id)
    return query.first()


def get_plantilla_by_public_id(db: Session, public_id: str, organization_id: int | None = None) -> Optional[models.Plantilla]:
    query = db.query(models.Plantilla).filter(models.Plantilla.public_id == public_id)
    if organization_id is not None:
        query = query.filter(models.Plantilla.organization_id == organization_id)
    return query.first()

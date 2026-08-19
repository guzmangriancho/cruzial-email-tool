from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from backend import models


def _repair_legacy_ai_references(db: Session) -> None:
    """
    Limpia exclusivamente referencias huérfanas de la IA antigua.

    Cruzial Local no usa estas tablas, pero algunas BBDD históricas conservan
    ia_propuestas con claves foráneas NO ACTION hacia campañas/segmentos. Una
    referencia huérfana puede provocar errores al modificar registros válidos.
    Se conserva la propuesta y solo se pone a NULL el identificador inexistente.
    """
    inspector = inspect(db.get_bind())
    if not inspector.has_table("ia_propuestas"):
        return

    columnas = {col["name"] for col in inspector.get_columns("ia_propuestas")}

    if "created_campaign_id" in columnas and inspector.has_table("campanas"):
        db.execute(text(
            """
            UPDATE ia_propuestas
            SET created_campaign_id = NULL
            WHERE created_campaign_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM campanas c WHERE c.id = ia_propuestas.created_campaign_id
              )
            """
        ))

    if "created_segment_id" in columnas and inspector.has_table("crm_segmentos"):
        db.execute(text(
            """
            UPDATE ia_propuestas
            SET created_segment_id = NULL
            WHERE created_segment_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM crm_segmentos s WHERE s.id = ia_propuestas.created_segment_id
              )
            """
        ))


def _ensure_local_settings_table(db: Session) -> None:
    """Crea ajustes simples propios de Cruzial Local sin tocar el esquema histórico."""
    db.execute(text(
        """
        CREATE TABLE IF NOT EXISTS cruzial_local_settings (
            clave TEXT PRIMARY KEY,
            valor TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    ))


def ensure_bootstrap_data(db: Session) -> None:
    """Crea la fila técnica local y repara compatibilidad de la BBDD histórica."""
    org = db.query(models.Organizacion).filter(models.Organizacion.id == 1).first()
    if org is None:
        db.add(models.Organizacion(
            id=1,
            nombre="Cruzial",
            slug="cruzial-local",
            tipo="internal",
            estado="active",
        ))

    _ensure_local_settings_table(db)
    _repair_legacy_ai_references(db)
    db.commit()

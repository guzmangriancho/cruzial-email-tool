"""HTTP controller layer for scraper.

This module keeps request/response flow separate from FastAPI route registration.
Business logic is delegated to backend.services.scraper_service.
"""

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

from backend import schemas
from backend.dependencies import get_db
from backend.services.scraper_service import *  # Re-export payload models used by type annotations.
from backend.services import scraper_service as service

def iniciar_busqueda(
    palabras_clave: str,
    ubicaciones: str,
    background_tasks: BackgroundTasks,
    modo_prueba: bool = False,
    db: Session = Depends(get_db),
):
    return service.iniciar_busqueda(palabras_clave=palabras_clave, ubicaciones=ubicaciones, background_tasks=background_tasks, modo_prueba=modo_prueba, db=db)

def consultar_estado(task_id: str, db: Session = Depends(get_db)):
    return service.consultar_estado(task_id=task_id, db=db)

def detener_busqueda(task_id: str, db: Session = Depends(get_db)):
    return service.detener_busqueda(task_id=task_id, db=db)

def enriquecer_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return service.enriquecer_cliente(cliente_id=cliente_id, db=db)


def diagnostico_entorno_scraper():
    return service.diagnostico_entorno_scraper()

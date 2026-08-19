"""Route definitions for scraper.

Routers only expose FastAPI endpoints and delegate request handling to controllers.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

from backend import schemas
from backend.dependencies import get_db
from backend.controllers.scraper_controller import *  # Payload models used by annotations.
from backend.controllers import scraper_controller as controller

router = APIRouter(prefix="/scraper", tags=["Scraper"])


@router.get("/diagnostico")
def diagnostico_entorno_scraper():
    return controller.diagnostico_entorno_scraper()

@router.post("/iniciar")
def iniciar_busqueda(
    palabras_clave: str,
    ubicaciones: str,
    background_tasks: BackgroundTasks,
    modo_prueba: bool = False,
    db: Session = Depends(get_db),
):
    return controller.iniciar_busqueda(palabras_clave=palabras_clave, ubicaciones=ubicaciones, background_tasks=background_tasks, modo_prueba=modo_prueba, db=db)

@router.get("/estado/{task_id}")
def consultar_estado(task_id: str, db: Session = Depends(get_db)):
    return controller.consultar_estado(task_id=task_id, db=db)

@router.post("/detener/{task_id}")
def detener_busqueda(task_id: str, db: Session = Depends(get_db)):
    return controller.detener_busqueda(task_id=task_id, db=db)

@router.post("/enriquecer/{cliente_id}")
def enriquecer_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return controller.enriquecer_cliente(cliente_id=cliente_id, db=db)

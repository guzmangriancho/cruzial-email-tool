"""HTTP controller layer for campanas.

This module keeps request/response flow separate from FastAPI route registration.
Business logic is delegated to backend.services.campanas_service.
"""

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

from backend import schemas
from backend.dependencies import get_db
from backend.services.campanas_service import *  # Re-export payload models used by type annotations.
from backend.services import campanas_service as service

def listar_campanas(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return service.listar_campanas(skip=skip, limit=limit, db=db)

def listar_adjuntos_disponibles():
    return service.listar_adjuntos_disponibles()

async def enviar_prueba_campana(
    email_destino: str = Form(...),
    nombre: str = Form("Prueba de campaña"),
    remitente: str = Form(...),
    asunto: str = Form(...),
    cuerpo_html: str = Form(...),
    adjuntos_genericos: str = Form("[]"),
    adjuntos_upload: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
):
    return await service.enviar_prueba_campana(email_destino=email_destino, nombre=nombre, remitente=remitente, asunto=asunto, cuerpo_html=cuerpo_html, adjuntos_genericos=adjuntos_genericos, adjuntos_upload=adjuntos_upload, db=db)

async def crear_campana_desde_csv(
    background_tasks: BackgroundTasks,
    nombre: str = Form(...),
    remitente: str = Form(...),
    asunto: str = Form(...),
    cuerpo_html: str = Form(...),
    delay_segundos: int = Form(30),
    lanzar_inmediatamente: bool = Form(False),
    csv_file: UploadFile = File(...),
    adjuntos_genericos: str = Form("[]"),
    adjuntos_upload: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
):
    return await service.crear_campana_desde_csv(background_tasks=background_tasks, nombre=nombre, remitente=remitente, asunto=asunto, cuerpo_html=cuerpo_html, delay_segundos=delay_segundos, lanzar_inmediatamente=lanzar_inmediatamente, csv_file=csv_file, adjuntos_genericos=adjuntos_genericos, adjuntos_upload=adjuntos_upload, db=db)

def lanzar_campana_legacy(
    payload: schemas.CampanaLanzarRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    return service.lanzar_campana_legacy(payload=payload, background_tasks=background_tasks, db=db)

def lanzar_campana_existente(
    campana_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    return service.lanzar_campana_existente(campana_id=campana_id, background_tasks=background_tasks, db=db)

def detener_campana(campana_id: int, db: Session = Depends(get_db)):
    return service.detener_campana(campana_id=campana_id, db=db)

def reanudar_campana(
    campana_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    return service.reanudar_campana(campana_id=campana_id, background_tasks=background_tasks, db=db)

def obtener_campana(
    campana_id: int,
    db: Session = Depends(get_db),
):
    return service.obtener_campana(campana_id=campana_id, db=db)

def actualizar_campana(
    campana_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    return service.actualizar_campana(campana_id=campana_id, payload=payload, db=db)

def consultar_estado_campana(campana_id: int, db: Session = Depends(get_db)):
    return service.consultar_estado_campana(campana_id=campana_id, db=db)

def consultar_estado_envio_legacy(task_id: str):
    return service.consultar_estado_envio_legacy(task_id=task_id)

def consultar_logs_campana(
    campana_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.consultar_logs_campana(campana_id=campana_id, limit=limit, db=db)

def eliminar_campana(campana_id: int, db: Session = Depends(get_db)):
    return service.eliminar_campana(campana_id=campana_id, db=db)

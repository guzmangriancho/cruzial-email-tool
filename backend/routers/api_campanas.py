"""Route definitions for campanas.

Routers only expose FastAPI endpoints and delegate request handling to controllers.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

from backend import schemas
from backend.dependencies import get_db
from backend.controllers.campanas_controller import *  # Payload models used by annotations.
from backend.controllers import campanas_controller as controller

router = APIRouter(prefix="/campanas", tags=["Campañas y Envíos"])

@router.get("/")
def listar_campanas(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return controller.listar_campanas(skip=skip, limit=limit, db=db)

@router.get("/adjuntos-disponibles")
def listar_adjuntos_disponibles():
    return controller.listar_adjuntos_disponibles()

@router.post("/enviar-prueba")
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
    return await controller.enviar_prueba_campana(email_destino=email_destino, nombre=nombre, remitente=remitente, asunto=asunto, cuerpo_html=cuerpo_html, adjuntos_genericos=adjuntos_genericos, adjuntos_upload=adjuntos_upload, db=db)

@router.post("/crear-csv")
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
    return await controller.crear_campana_desde_csv(background_tasks=background_tasks, nombre=nombre, remitente=remitente, asunto=asunto, cuerpo_html=cuerpo_html, delay_segundos=delay_segundos, lanzar_inmediatamente=lanzar_inmediatamente, csv_file=csv_file, adjuntos_genericos=adjuntos_genericos, adjuntos_upload=adjuntos_upload, db=db)

@router.post("/lanzar")
def lanzar_campana_legacy(
    payload: schemas.CampanaLanzarRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    return controller.lanzar_campana_legacy(payload=payload, background_tasks=background_tasks, db=db)

@router.post("/{campana_id}/lanzar")
def lanzar_campana_existente(
    campana_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    return controller.lanzar_campana_existente(campana_id=campana_id, background_tasks=background_tasks, db=db)

@router.post("/{campana_id}/detener")
def detener_campana(campana_id: int, db: Session = Depends(get_db)):
    return controller.detener_campana(campana_id=campana_id, db=db)

@router.post("/{campana_id}/reanudar")
def reanudar_campana(
    campana_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    return controller.reanudar_campana(campana_id=campana_id, background_tasks=background_tasks, db=db)

@router.get("/{campana_id}")
def obtener_campana(
    campana_id: int,
    db: Session = Depends(get_db),
):
    return controller.obtener_campana(campana_id=campana_id, db=db)

@router.put("/{campana_id}")
def actualizar_campana(
    campana_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    return controller.actualizar_campana(campana_id=campana_id, payload=payload, db=db)

@router.get("/{campana_id}/estado")
def consultar_estado_campana(campana_id: int, db: Session = Depends(get_db)):
    return controller.consultar_estado_campana(campana_id=campana_id, db=db)

@router.get("/estado/{task_id}")
def consultar_estado_envio_legacy(task_id: str):
    return controller.consultar_estado_envio_legacy(task_id=task_id)

@router.get("/{campana_id}/logs")
def consultar_logs_campana(
    campana_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return controller.consultar_logs_campana(campana_id=campana_id, limit=limit, db=db)

@router.delete("/{campana_id}")
def eliminar_campana(campana_id: int, db: Session = Depends(get_db)):
    return controller.eliminar_campana(campana_id=campana_id, db=db)

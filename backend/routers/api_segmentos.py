"""Route definitions for segmentos.

Routers only expose FastAPI endpoints and delegate request handling to controllers.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

from backend import schemas
from backend.dependencies import get_db
from backend.controllers.segmentos_controller import *  # Payload models used by annotations.
from backend.controllers import segmentos_controller as controller

router = APIRouter(prefix="/segmentos", tags=["Segmentos y Listas"])

@router.get("")
@router.get("/", include_in_schema=False)
def listar_segmentos(db: Session = Depends(get_db)):
    return controller.listar_segmentos(db=db)

@router.post("")
@router.post("/", include_in_schema=False)
def crear_segmento(payload: SegmentoPayload, db: Session = Depends(get_db)):
    return controller.crear_segmento(payload=payload, db=db)

@router.get("/{segmento_id}")
def obtener_segmento(segmento_id: int, db: Session = Depends(get_db)):
    return controller.obtener_segmento(segmento_id=segmento_id, db=db)

@router.put("/{segmento_id}")
def actualizar_segmento(
    segmento_id: int,
    payload: SegmentoPayload,
    db: Session = Depends(get_db),
):
    return controller.actualizar_segmento(segmento_id=segmento_id, payload=payload, db=db)

@router.delete("/{segmento_id}")
def eliminar_segmento(segmento_id: int, db: Session = Depends(get_db)):
    return controller.eliminar_segmento(segmento_id=segmento_id, db=db)

@router.get("/{segmento_id}/clientes")
def listar_clientes_segmento(
    segmento_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return controller.listar_clientes_segmento(segmento_id=segmento_id, skip=skip, limit=limit, db=db)

@router.get("/{segmento_id}/clientes-ids")
def listar_ids_clientes_segmento(segmento_id: int, db: Session = Depends(get_db)):
    return controller.listar_ids_clientes_segmento(segmento_id=segmento_id, db=db)

@router.post("/{segmento_id}/clientes")
def agregar_clientes_segmento(
    segmento_id: int,
    payload: Dict[str, List[int]],
    db: Session = Depends(get_db),
):
    return controller.agregar_clientes_segmento(segmento_id=segmento_id, payload=payload, db=db)

@router.delete("/{segmento_id}/clientes/{cliente_id}")
def quitar_cliente_segmento(
    segmento_id: int,
    cliente_id: int,
    db: Session = Depends(get_db),
):
    return controller.quitar_cliente_segmento(segmento_id=segmento_id, cliente_id=cliente_id, db=db)

@router.post("/{segmento_id}/materializar")
def materializar_segmento(segmento_id: int, db: Session = Depends(get_db)):
    return controller.materializar_segmento(segmento_id=segmento_id, db=db)

@router.get("/{segmento_id}/exportar-csv")
def exportar_segmento_csv(segmento_id: int, db: Session = Depends(get_db)):
    return controller.exportar_segmento_csv(segmento_id=segmento_id, db=db)

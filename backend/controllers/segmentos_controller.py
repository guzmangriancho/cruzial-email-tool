"""HTTP controller layer for segmentos.

This module keeps request/response flow separate from FastAPI route registration.
Business logic is delegated to backend.services.segmentos_service.
"""

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

from backend import schemas
from backend.dependencies import get_db
from backend.services.segmentos_service import *  # Re-export payload models used by type annotations.
from backend.services import segmentos_service as service

def listar_segmentos(db: Session = Depends(get_db)):
    return service.listar_segmentos(db=db)

def crear_segmento(payload: SegmentoPayload, db: Session = Depends(get_db)):
    return service.crear_segmento(payload=payload, db=db)

def obtener_segmento(segmento_id: int, db: Session = Depends(get_db)):
    return service.obtener_segmento(segmento_id=segmento_id, db=db)

def actualizar_segmento(
    segmento_id: int,
    payload: SegmentoPayload,
    db: Session = Depends(get_db),
):
    return service.actualizar_segmento(segmento_id=segmento_id, payload=payload, db=db)

def eliminar_segmento(segmento_id: int, db: Session = Depends(get_db)):
    return service.eliminar_segmento(segmento_id=segmento_id, db=db)

def listar_clientes_segmento(
    segmento_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return service.listar_clientes_segmento(segmento_id=segmento_id, skip=skip, limit=limit, db=db)

def listar_ids_clientes_segmento(segmento_id: int, db: Session = Depends(get_db)):
    return service.listar_ids_clientes_segmento(segmento_id=segmento_id, db=db)

def agregar_clientes_segmento(
    segmento_id: int,
    payload: Dict[str, List[int]],
    db: Session = Depends(get_db),
):
    return service.agregar_clientes_segmento(segmento_id=segmento_id, payload=payload, db=db)

def quitar_cliente_segmento(
    segmento_id: int,
    cliente_id: int,
    db: Session = Depends(get_db),
):
    return service.quitar_cliente_segmento(segmento_id=segmento_id, cliente_id=cliente_id, db=db)

def materializar_segmento(segmento_id: int, db: Session = Depends(get_db)):
    return service.materializar_segmento(segmento_id=segmento_id, db=db)

def exportar_segmento_csv(segmento_id: int, db: Session = Depends(get_db)):
    return service.exportar_segmento_csv(segmento_id=segmento_id, db=db)

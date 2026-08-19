"""Route definitions for clientes.

Routers only expose FastAPI endpoints and delegate request handling to controllers.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

from backend import schemas
from backend.dependencies import get_db
from backend.controllers.clientes_controller import *  # Payload models used by annotations.
from backend.controllers import clientes_controller as controller

router = APIRouter(prefix="/clientes", tags=["Clientes (CRM)"])

@router.get("/", response_model=List[schemas.ClienteResponse])
def listar_clientes(
    skip: int = 0,
    limit: int = 100,
    busqueda: Optional[str] = None,
    sector: Optional[str] = None,
    ciudad: Optional[str] = None,
    valoracion_min: Optional[float] = None,
    sort_by: Optional[str] = Query("fecha_captacion"),
    sort_dir: Optional[str] = Query("desc"),
    sin_email: bool = False,
    sin_telefono: bool = False,
    sin_sitio_web: bool = False,
    sin_direccion: bool = False,
    sin_ciudad: bool = False,
    sin_valoracion: bool = False,
    sin_resenas: bool = False,
    sin_url_maps: bool = False,
    email_estado: Optional[str] = Query(None),
    telefono_estado: Optional[str] = Query(None),
    sitio_web_estado: Optional[str] = Query(None),
    direccion_estado: Optional[str] = Query(None),
    ciudad_estado: Optional[str] = Query(None),
    valoracion_estado: Optional[str] = Query(None),
    resenas_estado: Optional[str] = Query(None),
    url_maps_estado: Optional[str] = Query(None),
    poligono: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return controller.listar_clientes(skip=skip, limit=limit, busqueda=busqueda, sector=sector, ciudad=ciudad, valoracion_min=valoracion_min, sort_by=sort_by, sort_dir=sort_dir, sin_email=sin_email, sin_telefono=sin_telefono, sin_sitio_web=sin_sitio_web, sin_direccion=sin_direccion, sin_ciudad=sin_ciudad, sin_valoracion=sin_valoracion, sin_resenas=sin_resenas, sin_url_maps=sin_url_maps, email_estado=email_estado, telefono_estado=telefono_estado, sitio_web_estado=sitio_web_estado, direccion_estado=direccion_estado, ciudad_estado=ciudad_estado, valoracion_estado=valoracion_estado, resenas_estado=resenas_estado, url_maps_estado=url_maps_estado, poligono=poligono, db=db)

@router.post("/", response_model=schemas.ClienteResponse)
def crear_cliente_manual(
    payload: ClienteUpsertPayload,
    db: Session = Depends(get_db),
):
    return controller.crear_cliente_manual(payload=payload, db=db)

@router.get("/exportar-csv")
def exportar_clientes_csv(
    busqueda: Optional[str] = None,
    sector: Optional[str] = None,
    ciudad: Optional[str] = None,
    valoracion_min: Optional[float] = None,
    sort_by: Optional[str] = Query("fecha_captacion"),
    sort_dir: Optional[str] = Query("desc"),
    sin_email: bool = False,
    sin_telefono: bool = False,
    sin_sitio_web: bool = False,
    sin_direccion: bool = False,
    sin_ciudad: bool = False,
    sin_valoracion: bool = False,
    sin_resenas: bool = False,
    sin_url_maps: bool = False,
    email_estado: Optional[str] = Query(None),
    telefono_estado: Optional[str] = Query(None),
    sitio_web_estado: Optional[str] = Query(None),
    direccion_estado: Optional[str] = Query(None),
    ciudad_estado: Optional[str] = Query(None),
    valoracion_estado: Optional[str] = Query(None),
    resenas_estado: Optional[str] = Query(None),
    url_maps_estado: Optional[str] = Query(None),
    poligono: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return controller.exportar_clientes_csv(busqueda=busqueda, sector=sector, ciudad=ciudad, valoracion_min=valoracion_min, sort_by=sort_by, sort_dir=sort_dir, sin_email=sin_email, sin_telefono=sin_telefono, sin_sitio_web=sin_sitio_web, sin_direccion=sin_direccion, sin_ciudad=sin_ciudad, sin_valoracion=sin_valoracion, sin_resenas=sin_resenas, sin_url_maps=sin_url_maps, email_estado=email_estado, telefono_estado=telefono_estado, sitio_web_estado=sitio_web_estado, direccion_estado=direccion_estado, ciudad_estado=ciudad_estado, valoracion_estado=valoracion_estado, resenas_estado=resenas_estado, url_maps_estado=url_maps_estado, poligono=poligono, db=db)

@router.post("/exportar-csv-seleccionados")
def exportar_clientes_csv_seleccionados(
    payload: ClientesIdsPayload,
    db: Session = Depends(get_db),
):
    return controller.exportar_clientes_csv_seleccionados(payload=payload, db=db)

@router.get("/mapa")
def listar_clientes_mapa(
    busqueda: Optional[str] = None,
    sector: Optional[str] = None,
    ciudad: Optional[str] = None,
    valoracion_min: Optional[float] = None,
    sort_by: Optional[str] = Query("fecha_captacion"),
    sort_dir: Optional[str] = Query("desc"),
    sin_email: bool = False,
    sin_telefono: bool = False,
    sin_sitio_web: bool = False,
    sin_direccion: bool = False,
    sin_ciudad: bool = False,
    sin_valoracion: bool = False,
    sin_resenas: bool = False,
    sin_url_maps: bool = False,
    email_estado: Optional[str] = Query(None),
    telefono_estado: Optional[str] = Query(None),
    sitio_web_estado: Optional[str] = Query(None),
    direccion_estado: Optional[str] = Query(None),
    ciudad_estado: Optional[str] = Query(None),
    valoracion_estado: Optional[str] = Query(None),
    resenas_estado: Optional[str] = Query(None),
    url_maps_estado: Optional[str] = Query(None),
    poligono: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return controller.listar_clientes_mapa(busqueda=busqueda, sector=sector, ciudad=ciudad, valoracion_min=valoracion_min, sort_by=sort_by, sort_dir=sort_dir, sin_email=sin_email, sin_telefono=sin_telefono, sin_sitio_web=sin_sitio_web, sin_direccion=sin_direccion, sin_ciudad=sin_ciudad, sin_valoracion=sin_valoracion, sin_resenas=sin_resenas, sin_url_maps=sin_url_maps, email_estado=email_estado, telefono_estado=telefono_estado, sitio_web_estado=sitio_web_estado, direccion_estado=direccion_estado, ciudad_estado=ciudad_estado, valoracion_estado=valoracion_estado, resenas_estado=resenas_estado, url_maps_estado=url_maps_estado, poligono=poligono, db=db)

@router.get("/sectores", response_model=List[str])
def listar_sectores_unicos(db: Session = Depends(get_db)):
    return controller.listar_sectores_unicos(db=db)

@router.post("/importacion_masiva")
def importar_clientes_csv(
    clientes: List[schemas.ClienteImportar],
    db: Session = Depends(get_db),
):
    return controller.importar_clientes_csv(clientes=clientes, db=db)


@router.post("/importacion_csv_archivo")
async def importar_clientes_csv_archivo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    contenido = await file.read()
    return controller.importar_clientes_csv_archivo(
        contenido=contenido,
        filename=file.filename,
        db=db,
    )

@router.get("/pendientes-ids", response_model=List[int])
def obtener_ids_pendientes(db: Session = Depends(get_db)):
    return controller.obtener_ids_pendientes(db=db)

@router.post("/limpiar-bd")
def limpiar_base_datos(db: Session = Depends(get_db)):
    return controller.limpiar_base_datos(db=db)

@router.post("/eliminar-masivo")
def eliminar_clientes_masivo(
    payload: ClientesIdsPayload,
    db: Session = Depends(get_db),
):
    return controller.eliminar_clientes_masivo(payload=payload, db=db)

@router.put("/{cliente_id}", response_model=schemas.ClienteResponse)
def actualizar_cliente_manual(
    cliente_id: int,
    payload: ClienteUpsertPayload,
    db: Session = Depends(get_db),
):
    return controller.actualizar_cliente_manual(cliente_id=cliente_id, payload=payload, db=db)

@router.get("/{cliente_id}", response_model=schemas.ClienteResponse)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return controller.obtener_cliente(cliente_id=cliente_id, db=db)

@router.delete("/{cliente_id}")
def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return controller.eliminar_cliente(cliente_id=cliente_id, db=db)

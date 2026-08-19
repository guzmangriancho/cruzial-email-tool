"""HTTP controller layer for clientes.

This module keeps request/response flow separate from FastAPI route registration.
Business logic is delegated to backend.services.clientes_service.
"""

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

from backend import schemas
from backend.dependencies import get_db
from backend.services.clientes_service import *  # Re-export payload models used by type annotations.
from backend.services import clientes_service as service

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
    return service.listar_clientes(skip=skip, limit=limit, busqueda=busqueda, sector=sector, ciudad=ciudad, valoracion_min=valoracion_min, sort_by=sort_by, sort_dir=sort_dir, sin_email=sin_email, sin_telefono=sin_telefono, sin_sitio_web=sin_sitio_web, sin_direccion=sin_direccion, sin_ciudad=sin_ciudad, sin_valoracion=sin_valoracion, sin_resenas=sin_resenas, sin_url_maps=sin_url_maps, email_estado=email_estado, telefono_estado=telefono_estado, sitio_web_estado=sitio_web_estado, direccion_estado=direccion_estado, ciudad_estado=ciudad_estado, valoracion_estado=valoracion_estado, resenas_estado=resenas_estado, url_maps_estado=url_maps_estado, poligono=poligono, db=db)

def crear_cliente_manual(
    payload: ClienteUpsertPayload,
    db: Session = Depends(get_db),
):
    return service.crear_cliente_manual(payload=payload, db=db)

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
    return service.exportar_clientes_csv(busqueda=busqueda, sector=sector, ciudad=ciudad, valoracion_min=valoracion_min, sort_by=sort_by, sort_dir=sort_dir, sin_email=sin_email, sin_telefono=sin_telefono, sin_sitio_web=sin_sitio_web, sin_direccion=sin_direccion, sin_ciudad=sin_ciudad, sin_valoracion=sin_valoracion, sin_resenas=sin_resenas, sin_url_maps=sin_url_maps, email_estado=email_estado, telefono_estado=telefono_estado, sitio_web_estado=sitio_web_estado, direccion_estado=direccion_estado, ciudad_estado=ciudad_estado, valoracion_estado=valoracion_estado, resenas_estado=resenas_estado, url_maps_estado=url_maps_estado, poligono=poligono, db=db)

def exportar_clientes_csv_seleccionados(
    payload: ClientesIdsPayload,
    db: Session = Depends(get_db),
):
    return service.exportar_clientes_csv_seleccionados(payload=payload, db=db)

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
    return service.listar_clientes_mapa(busqueda=busqueda, sector=sector, ciudad=ciudad, valoracion_min=valoracion_min, sort_by=sort_by, sort_dir=sort_dir, sin_email=sin_email, sin_telefono=sin_telefono, sin_sitio_web=sin_sitio_web, sin_direccion=sin_direccion, sin_ciudad=sin_ciudad, sin_valoracion=sin_valoracion, sin_resenas=sin_resenas, sin_url_maps=sin_url_maps, email_estado=email_estado, telefono_estado=telefono_estado, sitio_web_estado=sitio_web_estado, direccion_estado=direccion_estado, ciudad_estado=ciudad_estado, valoracion_estado=valoracion_estado, resenas_estado=resenas_estado, url_maps_estado=url_maps_estado, poligono=poligono, db=db)

def listar_sectores_unicos(db: Session = Depends(get_db)):
    return service.listar_sectores_unicos(db=db)

def importar_clientes_csv(
    clientes: List[schemas.ClienteImportar],
    db: Session = Depends(get_db),
):
    return service.importar_clientes_csv(clientes=clientes, db=db)


def importar_clientes_csv_archivo(
    contenido: bytes,
    filename: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return service.importar_clientes_csv_archivo(contenido=contenido, filename=filename, db=db)

def obtener_ids_pendientes(db: Session = Depends(get_db)):
    return service.obtener_ids_pendientes(db=db)

def limpiar_base_datos(db: Session = Depends(get_db)):
    return service.limpiar_base_datos(db=db)

def eliminar_clientes_masivo(
    payload: ClientesIdsPayload,
    db: Session = Depends(get_db),
):
    return service.eliminar_clientes_masivo(payload=payload, db=db)

def actualizar_cliente_manual(
    cliente_id: int,
    payload: ClienteUpsertPayload,
    db: Session = Depends(get_db),
):
    return service.actualizar_cliente_manual(cliente_id=cliente_id, payload=payload, db=db)

def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return service.obtener_cliente(cliente_id=cliente_id, db=db)

def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return service.eliminar_cliente(cliente_id=cliente_id, db=db)

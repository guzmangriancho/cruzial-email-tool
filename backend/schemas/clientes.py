from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, EmailStr


class ClienteBase(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    sitio_web: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    url_maps: Optional[str] = None
    valoracion: Optional[float] = None
    num_resenas: Optional[int] = None
    categoria_google: Optional[str] = None
    termino_busqueda: Optional[str] = None
    sector: Optional[str] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteResponse(BaseModel):
    id: int
    public_id: str
    nombre: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    sitio_web: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    url_maps: Optional[str] = None
    valoracion: Optional[float] = None
    num_resenas: Optional[int] = None
    categoria_google: Optional[str] = None
    termino_busqueda: Optional[str] = None
    sector: Optional[str] = None
    prioridad: Optional[int] = None
    fecha_captacion: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClienteImportar(BaseModel):
    """
    Payload tolerante para importaciones masivas.

    Importante:
    - No usamos EmailStr ni floats estrictos aquí para evitar que una fila mala
      tumbe toda la importación con 422.
    - La limpieza/conversión campo a campo se hace en el servicio, de forma que
      se importe la fila aunque falle un dato concreto.
    - El campo `id` del CSV se conserva solo como referencia externa y no se usa
      como PK de la base de datos.
    """

    id: Optional[Any] = None
    email: Optional[Any] = None
    nombre: Optional[Any] = None
    telefono: Optional[Any] = None
    sitio_web: Optional[Any] = None
    direccion: Optional[Any] = None
    ciudad: Optional[Any] = None
    sector: Optional[Any] = None
    categoria_google: Optional[Any] = None
    latitud: Optional[Any] = None
    longitud: Optional[Any] = None
    url_maps: Optional[Any] = None
    valoracion: Optional[Any] = None
    num_resenas: Optional[Any] = None
    termino_busqueda: Optional[Any] = None
    fecha_captacion: Optional[Any] = None


class ClientesIdsPayload(BaseModel):
    ids: List[int]


class ClienteUpsertPayload(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    sitio_web: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    url_maps: Optional[str] = None
    valoracion: Optional[float] = None
    num_resenas: Optional[int] = None
    categoria_google: Optional[str] = None
    sector: Optional[str] = None

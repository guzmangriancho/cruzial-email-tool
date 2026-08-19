from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class CampanaLanzarRequest(BaseModel):
    cliente_ids: List[int]
    asunto: str
    cuerpo: str
    remitente: str
    nombre: Optional[str] = None
    delay_segundos: int = 30


class PlantillaResponse(BaseModel):
    id: int
    public_id: str
    nombre_interno: str
    asunto: str
    cuerpo_html: str
    fecha_creacion: datetime | None = None

    class Config:
        from_attributes = True


class CampanaResponse(BaseModel):
    id: int
    public_id: str
    nombre: str
    fecha_creacion: datetime | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    estado: str
    plantilla_id: int | None = None
    remitente: str | None = None
    delay_segundos: int | None = None
    total_destinatarios: int | None = None

    class Config:
        from_attributes = True


class EnvioLogResponse(BaseModel):
    id: int
    campana_id: int | None = None
    cliente_id: int | None = None
    fecha_envio: datetime | None = None
    estado: str
    detalle_error: str | None = None
    intentos: int | None = None

    class Config:
        from_attributes = True

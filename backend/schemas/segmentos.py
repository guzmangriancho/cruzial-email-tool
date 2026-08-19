from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class SegmentoPayload(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    tipo: str = "dinamico"
    filtros: Optional[Dict[str, Any]] = None
    cliente_ids: Optional[List[int]] = None
    color: Optional[str] = "blue"

"""Campaña-domain utility helpers.

Adjuntos, CSV, renderizado y validaciones específicas de campañas pueden ir
migrándose aquí de forma gradual desde campanas_service.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def email_valido(email: Optional[str]) -> bool:
    return bool(email and EMAIL_RE.fullmatch(email.strip()))


def nombre_archivo_seguro(nombre: str) -> str:
    nombre = Path(nombre or "").name.strip()
    if not nombre or nombre in {".", ".."}:
        return ""
    return nombre


def limpiar_texto(valor) -> Optional[str]:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None

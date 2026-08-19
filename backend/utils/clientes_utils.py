"""Cliente-domain utility helpers.

Keep pure helpers here when extracting logic from clientes_service. The service
may still expose some legacy helpers while the refactor is migrated safely.
"""

from __future__ import annotations

import json
import re
from typing import List, Optional


def limpiar_texto(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    valor_limpio = valor.strip()
    return valor_limpio or None


def normalizar_email(valor: Optional[str]) -> Optional[str]:
    email = limpiar_texto(valor)
    return email.lower() if email else None


def parsear_poligono(poligono_raw: Optional[str]) -> Optional[List[List[float]]]:
    if not poligono_raw:
        return None
    try:
        poligono = json.loads(poligono_raw)
        if not isinstance(poligono, list) or len(poligono) < 3:
            return None
        coords: List[List[float]] = []
        for punto in poligono:
            if not isinstance(punto, list) or len(punto) != 2:
                return None
            lat = float(punto[0])
            lng = float(punto[1])
            if lat < -90 or lat > 90 or lng < -180 or lng > 180:
                return None
            coords.append([lat, lng])
        return coords
    except Exception:
        return None


def punto_en_poligono(lat: float, lng: float, poligono: List[List[float]]) -> bool:
    x = lng
    y = lat
    dentro = False
    j = len(poligono) - 1
    for i in range(len(poligono)):
        yi = poligono[i][0]
        xi = poligono[i][1]
        yj = poligono[j][0]
        xj = poligono[j][1]
        cruza_horizontal = (yi > y) != (yj > y)
        if cruza_horizontal:
            x_interseccion = ((xj - xi) * (y - yi) / ((yj - yi) or 1e-12)) + xi
            if x < x_interseccion:
                dentro = not dentro
        j = i
    return dentro


def terminos_busqueda(busqueda: Optional[str]) -> List[str]:
    if not busqueda or not busqueda.strip():
        return []
    return [termino.strip() for termino in re.split(r"\s+", busqueda.strip()) if termino.strip()]

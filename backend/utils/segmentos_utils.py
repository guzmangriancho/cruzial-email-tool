"""Segmento-domain utility helpers.

Pure validation/normalization functions for dynamic and static segments.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

TIPOS_SEGMENTO = {"dinamico", "estatico"}
COLORES_PERMITIDOS = {"blue", "green", "purple", "amber", "red", "slate"}


def limpiar_texto(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    valor_limpio = valor.strip()
    return valor_limpio or None


def limpiar_ids(ids: Optional[List[int]]) -> List[int]:
    if not ids:
        return []
    ids_limpios: List[int] = []
    vistos = set()
    for raw_id in ids:
        try:
            cliente_id = int(raw_id)
        except Exception:
            continue
        if cliente_id <= 0 or cliente_id in vistos:
            continue
        vistos.add(cliente_id)
        ids_limpios.append(cliente_id)
    return ids_limpios


def limpiar_filtros_por_claves(filtros: Optional[Dict[str, Any]], claves_permitidas: set[str]) -> Dict[str, Any]:
    if not filtros:
        return {}
    filtros_limpios: Dict[str, Any] = {}
    for clave, valor in filtros.items():
        if clave not in claves_permitidas or valor is None or valor == "":
            continue
        filtros_limpios[clave] = valor
    return filtros_limpios

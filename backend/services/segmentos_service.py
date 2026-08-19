import csv
import io
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.dependencies import get_db
from backend import models
from backend.schemas.segmentos import SegmentoPayload
from backend.services.clientes_service import obtener_clientes_filtrados
from backend.utils.tenant import current_organization_id, current_user_id
from backend.utils.ids import generate_public_id


TIPOS_SEGMENTO = {"dinamico", "estatico"}
COLORES_PERMITIDOS = {"blue", "green", "purple", "amber", "red", "slate"}
CLIENTES_TABLE = models.Cliente.__tablename__

FILTROS_CLIENTE_PERMITIDOS = {
    "busqueda",
    "sector",
    "ciudad",
    "valoracion_min",
    "sort_by",
    "sort_dir",
    "email_estado",
    "telefono_estado",
    "sitio_web_estado",
    "direccion_estado",
    "ciudad_estado",
    "valoracion_estado",
    "resenas_estado",
    "url_maps_estado",
    "poligono",
}


def add_column_if_missing(db: Session, table_name: str, column_name: str, column_sql: str) -> None:
    inspector = inspect(db.get_bind() if hasattr(db, "get_bind") else db.bind)
    if table_name not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name not in existing_columns:
        db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}"))


def backfill_segmentos_public_id(db: Session) -> None:
    rows = db.execute(
        text("SELECT id FROM crm_segmentos WHERE public_id IS NULL OR public_id = ''")
    ).all()

    for row in rows:
        db.execute(
            text("UPDATE crm_segmentos SET public_id = :public_id WHERE id = :id"),
            {"id": row[0], "public_id": generate_public_id()},
        )


def insert_ignore_segmento_cliente_sql(db: Session) -> str:
    return """
        INSERT OR IGNORE INTO crm_segmento_clientes
        (organization_id, segmento_id, cliente_id, fecha_agregado)
        VALUES (:organization_id, :segmento_id, :cliente_id, :fecha_agregado)
    """


# ========================================================
# SCHEMA LIGERO
# ========================================================

def ensure_segmentos_schema(db: Session) -> None:
    """
    Crea y actualiza las tablas mínimas de segmentos en SQLite.
    Mantiene compatibilidad con bases antiguas sin depender de servicios externos.
    """
    id_col = "INTEGER PRIMARY KEY AUTOINCREMENT"

    db.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS crm_segmentos (
                id {id_col},
                public_id TEXT UNIQUE,
                organization_id INTEGER NOT NULL DEFAULT 1,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                tipo TEXT NOT NULL DEFAULT 'dinamico',
                filtros_json TEXT,
                color TEXT DEFAULT 'blue',
                created_by_user_id INTEGER,
                updated_by_user_id INTEGER,
                fecha_creacion TEXT NOT NULL,
                fecha_actualizacion TEXT NOT NULL
            )
            """
        )
    )

    db.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS crm_segmento_clientes (
                id {id_col},
                organization_id INTEGER NOT NULL DEFAULT 1,
                segmento_id INTEGER NOT NULL,
                cliente_id INTEGER NOT NULL,
                fecha_agregado TEXT NOT NULL,
                UNIQUE (organization_id, segmento_id, cliente_id)
            )
            """
        )
    )

    # Upgrades defensivos para bases creadas antes de la reestructuración.
    add_column_if_missing(db, "crm_segmentos", "public_id", "TEXT")
    add_column_if_missing(db, "crm_segmentos", "organization_id", "INTEGER NOT NULL DEFAULT 1")
    add_column_if_missing(db, "crm_segmentos", "descripcion", "TEXT")
    add_column_if_missing(db, "crm_segmentos", "tipo", "TEXT NOT NULL DEFAULT 'dinamico'")
    add_column_if_missing(db, "crm_segmentos", "filtros_json", "TEXT")
    add_column_if_missing(db, "crm_segmentos", "color", "TEXT DEFAULT 'blue'")
    add_column_if_missing(db, "crm_segmentos", "created_by_user_id", "INTEGER")
    add_column_if_missing(db, "crm_segmentos", "updated_by_user_id", "INTEGER")
    add_column_if_missing(db, "crm_segmentos", "fecha_creacion", "TEXT")
    add_column_if_missing(db, "crm_segmentos", "fecha_actualizacion", "TEXT")

    add_column_if_missing(db, "crm_segmento_clientes", "organization_id", "INTEGER NOT NULL DEFAULT 1")
    add_column_if_missing(db, "crm_segmento_clientes", "fecha_agregado", "TEXT")

    backfill_segmentos_public_id(db)

    db.commit()


# ========================================================
# HELPERS
# ========================================================

def ahora_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


def limpiar_texto(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None

    valor_limpio = valor.strip()
    return valor_limpio or None


def limpiar_tipo(tipo: Optional[str]) -> str:
    tipo_limpio = (tipo or "dinamico").strip().lower()

    if tipo_limpio not in TIPOS_SEGMENTO:
        raise HTTPException(status_code=422, detail="Tipo inválido. Usa dinamico o estatico.")

    return tipo_limpio


def limpiar_color(color: Optional[str]) -> str:
    color_limpio = (color or "blue").strip().lower()
    return color_limpio if color_limpio in COLORES_PERMITIDOS else "blue"


def limpiar_filtros(filtros: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not filtros:
        return {}

    filtros_limpios: Dict[str, Any] = {}

    for clave, valor in filtros.items():
        if clave not in FILTROS_CLIENTE_PERMITIDOS:
            continue

        if valor is None or valor == "":
            continue

        filtros_limpios[clave] = valor

    return filtros_limpios


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


def filtros_desde_json(filtros_json: Optional[str]) -> Dict[str, Any]:
    if not filtros_json:
        return {}

    try:
        filtros = json.loads(filtros_json)
        return limpiar_filtros(filtros if isinstance(filtros, dict) else {})
    except Exception:
        return {}


def row_to_segmento(row, total_clientes: int = 0) -> Dict[str, Any]:
    row = dict(row)
    filtros = filtros_desde_json(row.get("filtros_json"))

    return {
        "id": row["id"],
        "public_id": row.get("public_id"),
        "nombre": row["nombre"],
        "descripcion": row.get("descripcion"),
        "tipo": row["tipo"],
        "filtros": filtros if row["tipo"] == "dinamico" else None,
        "color": row.get("color") or "blue",
        "total_clientes": total_clientes,
        "fecha_creacion": row.get("fecha_creacion"),
        "fecha_actualizacion": row.get("fecha_actualizacion"),
    }


def cliente_to_dict(c: models.Cliente) -> Dict[str, Any]:
    return {
        "id": c.id,
        "public_id": c.public_id,
        "nombre": c.nombre,
        "email": c.email,
        "telefono": c.telefono,
        "sitio_web": c.sitio_web,
        "direccion": c.direccion,
        "ciudad": c.ciudad,
        "latitud": c.latitud,
        "longitud": c.longitud,
        "url_maps": c.url_maps,
        "valoracion": c.valoracion,
        "num_resenas": c.num_resenas,
        "categoria_google": c.categoria_google,
        "sector": c.sector,
        "fecha_captacion": c.fecha_captacion.isoformat() if getattr(c, "fecha_captacion", None) else None,
    }


def obtener_row_segmento(db: Session, segmento_id: int):
    ensure_segmentos_schema(db)
    organization_id = current_organization_id(db)

    row = db.execute(
        text("SELECT * FROM crm_segmentos WHERE id = :id AND organization_id = :organization_id"),
        {"id": segmento_id, "organization_id": organization_id},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Segmento no encontrado")

    return row


def contar_clientes_segmento(db: Session, row) -> int:
    row = dict(row)
    tipo = row["tipo"]

    if tipo == "dinamico":
        filtros = filtros_desde_json(row.get("filtros_json"))
        clientes = obtener_clientes_filtrados(db=db, paginar=False, organization_id=current_organization_id(db), **filtros)
        return len(clientes)

    count = db.execute(
        text(
            f"""
            SELECT COUNT(*) AS total
            FROM crm_segmento_clientes sc
            INNER JOIN {CLIENTES_TABLE} c ON c.id = sc.cliente_id
            WHERE sc.organization_id = :organization_id
              AND c.organization_id = :organization_id
              AND sc.segmento_id = :segmento_id
            """
        ),
        {"segmento_id": row["id"], "organization_id": current_organization_id(db)},
    ).scalar()

    return int(count or 0)


def obtener_segmento_dict(db: Session, segmento_id: int) -> Dict[str, Any]:
    row = obtener_row_segmento(db, segmento_id)
    return row_to_segmento(row, total_clientes=contar_clientes_segmento(db, row))


def clientes_de_segmento(db: Session, row, skip: int = 0, limit: int = 100) -> List[models.Cliente]:
    row = dict(row)
    if row["tipo"] == "dinamico":
        filtros = filtros_desde_json(row.get("filtros_json"))
        return obtener_clientes_filtrados(
            db=db,
            organization_id=current_organization_id(db),
            skip=skip,
            limit=limit,
            paginar=True,
            **filtros,
        )

    ids = [
        r[0]
        for r in db.execute(
            text(
                """
                SELECT cliente_id
                FROM crm_segmento_clientes
                WHERE organization_id = :organization_id AND segmento_id = :segmento_id
                ORDER BY fecha_agregado DESC
                LIMIT :limit OFFSET :skip
                """
            ),
            {"segmento_id": row["id"], "organization_id": current_organization_id(db), "limit": limit, "skip": skip},
        ).all()
    ]

    if not ids:
        return []

    organization_id = current_organization_id(db)
    clientes = db.query(models.Cliente).filter(
        models.Cliente.organization_id == organization_id,
        models.Cliente.id.in_(ids),
    ).all()
    clientes_por_id = {cliente.id: cliente for cliente in clientes}

    return [clientes_por_id[cliente_id] for cliente_id in ids if cliente_id in clientes_por_id]


def ids_clientes_segmento(db: Session, row) -> List[int]:
    row = dict(row)
    if row["tipo"] == "dinamico":
        filtros = filtros_desde_json(row.get("filtros_json"))
        clientes = obtener_clientes_filtrados(db=db, paginar=False, organization_id=current_organization_id(db), **filtros)
        return [cliente.id for cliente in clientes]

    return [
        r[0]
        for r in db.execute(
            text(
                f"""
                SELECT sc.cliente_id
                FROM crm_segmento_clientes sc
                INNER JOIN {CLIENTES_TABLE} c ON c.id = sc.cliente_id
                WHERE sc.organization_id = :organization_id
              AND c.organization_id = :organization_id
              AND sc.segmento_id = :segmento_id
                ORDER BY sc.fecha_agregado DESC
                """
            ),
            {"segmento_id": row["id"], "organization_id": current_organization_id(db)},
        ).all()
    ]


def insertar_clientes_segmento(db: Session, segmento_id: int, cliente_ids: List[int]) -> None:
    organization_id = current_organization_id(db)
    if not cliente_ids:
        return

    existentes = {
        r[0]
        for r in db.query(models.Cliente.id)
        .filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.id.in_(cliente_ids),
        )
        .all()
    }

    fecha = ahora_iso()

    for cliente_id in cliente_ids:
        if cliente_id not in existentes:
            continue

        db.execute(
            text(insert_ignore_segmento_cliente_sql(db)),
            {
                "organization_id": organization_id,
                "segmento_id": segmento_id,
                "cliente_id": cliente_id,
                "fecha_agregado": fecha,
            },
        )


def nombre_archivo_csv(nombre: str) -> str:
    limpio = "".join(ch if ch.isalnum() else "_" for ch in nombre.lower()).strip("_")
    return f"segmento_{limpio or 'clientes'}.csv"


# ========================================================
# ENDPOINTS
# ========================================================

def listar_segmentos(db: Session = Depends(get_db)):
    ensure_segmentos_schema(db)

    organization_id = current_organization_id(db)
    rows = db.execute(
        text("SELECT * FROM crm_segmentos WHERE organization_id = :organization_id ORDER BY fecha_actualizacion DESC, id DESC"),
        {"organization_id": organization_id},
    ).mappings().all()

    return [row_to_segmento(row, contar_clientes_segmento(db, row)) for row in rows]


def crear_segmento(payload: SegmentoPayload, db: Session = Depends(get_db)):
    ensure_segmentos_schema(db)

    nombre = limpiar_texto(payload.nombre)

    if not nombre:
        raise HTTPException(status_code=400, detail="El segmento necesita un nombre.")

    tipo = limpiar_tipo(payload.tipo)
    color = limpiar_color(payload.color)
    filtros = limpiar_filtros(payload.filtros)
    cliente_ids = limpiar_ids(payload.cliente_ids)

    if tipo == "estatico" and not cliente_ids:
        raise HTTPException(status_code=400, detail="Una lista fija necesita al menos un cliente.")

    fecha = ahora_iso()

    organization_id = current_organization_id(db)
    user_id = current_user_id(db)
    public_id = generate_public_id()
    params = {
        "public_id": public_id,
        "organization_id": organization_id,
        "nombre": nombre,
        "descripcion": limpiar_texto(payload.descripcion),
        "tipo": tipo,
        "filtros_json": json.dumps(filtros, ensure_ascii=False) if tipo == "dinamico" else None,
        "color": color,
        "created_by_user_id": user_id,
        "updated_by_user_id": user_id,
        "fecha_creacion": fecha,
        "fecha_actualizacion": fecha,
    }

    insert_sql = """
        INSERT INTO crm_segmentos
        (public_id, organization_id, nombre, descripcion, tipo, filtros_json, color, created_by_user_id, updated_by_user_id, fecha_creacion, fecha_actualizacion)
        VALUES (:public_id, :organization_id, :nombre, :descripcion, :tipo, :filtros_json, :color, :created_by_user_id, :updated_by_user_id, :fecha_creacion, :fecha_actualizacion)
    """

    try:
        result = db.execute(text(insert_sql), params)
        segmento_id = getattr(result, "lastrowid", None)

        if not segmento_id:
            segmento_id = db.execute(
                text("SELECT id FROM crm_segmentos WHERE public_id = :public_id"),
                {"public_id": public_id},
            ).scalar_one()

        segmento_id = int(segmento_id)

        if tipo == "estatico":
            insertar_clientes_segmento(db, segmento_id, cliente_ids)

        db.commit()
        return obtener_segmento_dict(db, segmento_id)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creando segmento: {exc}")


def obtener_segmento(segmento_id: int, db: Session = Depends(get_db)):
    return obtener_segmento_dict(db, segmento_id)


def actualizar_segmento(
    segmento_id: int,
    payload: SegmentoPayload,
    db: Session = Depends(get_db),
):
    row = obtener_row_segmento(db, segmento_id)

    nombre = limpiar_texto(payload.nombre)

    if not nombre:
        raise HTTPException(status_code=400, detail="El segmento necesita un nombre.")

    tipo_actual = row["tipo"]
    tipo_nuevo = limpiar_tipo(payload.tipo or tipo_actual)

    # Para evitar errores accidentales, no se cambia el tipo en edición.
    # Si quieres congelar un dinámico, usa /materializar.
    if tipo_nuevo != tipo_actual:
        raise HTTPException(
            status_code=400,
            detail="No se puede cambiar el tipo de segmento editando. Usa materializar para congelar uno dinámico.",
        )

    filtros = limpiar_filtros(payload.filtros)
    fecha = ahora_iso()

    db.execute(
        text(
            """
            UPDATE crm_segmentos
            SET nombre = :nombre,
                descripcion = :descripcion,
                filtros_json = :filtros_json,
                color = :color,
                updated_by_user_id = :updated_by_user_id,
                fecha_actualizacion = :fecha_actualizacion
            WHERE id = :id AND organization_id = :organization_id
            """
        ),
        {
            "id": segmento_id,
            "organization_id": current_organization_id(db),
            "updated_by_user_id": current_user_id(db),
            "nombre": nombre,
            "descripcion": limpiar_texto(payload.descripcion),
            "filtros_json": json.dumps(filtros, ensure_ascii=False) if tipo_actual == "dinamico" else dict(row).get("filtros_json"),
            "color": limpiar_color(payload.color),
            "fecha_actualizacion": fecha,
        },
    )

    db.commit()

    return obtener_segmento_dict(db, segmento_id)


def eliminar_segmento(segmento_id: int, db: Session = Depends(get_db)):
    row = obtener_row_segmento(db, segmento_id)
    organization_id = current_organization_id(db)

    try:
        # Compatibilidad con la BBDD histórica: ia_propuestas sigue existiendo
        # aunque la IA se haya eliminado del producto y referencia segmentos con
        # una FK NO ACTION. Conservamos el histórico anulando solo ese vínculo.
        inspector = inspect(db.get_bind())
        if inspector.has_table("ia_propuestas"):
            columnas = {col["name"] for col in inspector.get_columns("ia_propuestas")}
            if "created_segment_id" in columnas:
                db.execute(
                    text(
                        "UPDATE ia_propuestas "
                        "SET created_segment_id = NULL "
                        "WHERE created_segment_id = :segmento_id"
                    ),
                    {"segmento_id": segmento_id},
                )

        db.execute(
            text(
                "DELETE FROM crm_segmento_clientes "
                "WHERE organization_id = :organization_id AND segmento_id = :id"
            ),
            {"id": segmento_id, "organization_id": organization_id},
        )
        db.execute(
            text(
                "DELETE FROM crm_segmentos "
                "WHERE organization_id = :organization_id AND id = :id"
            ),
            {"id": segmento_id, "organization_id": organization_id},
        )
        db.commit()
    except Exception:
        db.rollback()
        import logging
        logging.getLogger("cruzial").exception(
            "Error eliminando segmento id=%s organization_id=%s",
            segmento_id,
            organization_id,
        )
        raise HTTPException(
            status_code=500,
            detail="No se pudo eliminar el segmento. Revisa logs/cruzial.log.",
        )

    return {"mensaje": f"Segmento '{row['nombre']}' eliminado correctamente."}


def listar_clientes_segmento(
    segmento_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    row = obtener_row_segmento(db, segmento_id)
    total = contar_clientes_segmento(db, row)
    clientes = clientes_de_segmento(db, row, skip=skip, limit=limit)

    return {
        "segmento": row_to_segmento(row, total),
        "clientes": [cliente_to_dict(cliente) for cliente in clientes],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


def listar_ids_clientes_segmento(segmento_id: int, db: Session = Depends(get_db)):
    row = obtener_row_segmento(db, segmento_id)
    return {"ids": ids_clientes_segmento(db, row)}


def agregar_clientes_segmento(
    segmento_id: int,
    payload: Dict[str, List[int]],
    db: Session = Depends(get_db),
):
    row = obtener_row_segmento(db, segmento_id)

    if row["tipo"] != "estatico":
        raise HTTPException(status_code=400, detail="Solo puedes añadir clientes manualmente a listas fijas.")

    cliente_ids = limpiar_ids(payload.get("cliente_ids"))

    if not cliente_ids:
        raise HTTPException(status_code=400, detail="No se recibieron clientes para añadir.")

    insertar_clientes_segmento(db, segmento_id, cliente_ids)

    db.execute(
        text("UPDATE crm_segmentos SET updated_by_user_id = :user_id, fecha_actualizacion = :fecha WHERE organization_id = :organization_id AND id = :id"),
        {"id": segmento_id, "organization_id": current_organization_id(db), "user_id": current_user_id(db), "fecha": ahora_iso()},
    )
    db.commit()

    return obtener_segmento_dict(db, segmento_id)


def quitar_cliente_segmento(
    segmento_id: int,
    cliente_id: int,
    db: Session = Depends(get_db),
):
    row = obtener_row_segmento(db, segmento_id)

    if row["tipo"] != "estatico":
        raise HTTPException(status_code=400, detail="Solo puedes quitar clientes manualmente de listas fijas.")

    db.execute(
        text(
            """
            DELETE FROM crm_segmento_clientes
            WHERE organization_id = :organization_id AND segmento_id = :segmento_id AND cliente_id = :cliente_id
            """
        ),
        {"segmento_id": segmento_id, "cliente_id": cliente_id, "organization_id": current_organization_id(db)},
    )
    db.execute(
        text("UPDATE crm_segmentos SET updated_by_user_id = :user_id, fecha_actualizacion = :fecha WHERE organization_id = :organization_id AND id = :id"),
        {"id": segmento_id, "organization_id": current_organization_id(db), "user_id": current_user_id(db), "fecha": ahora_iso()},
    )
    db.commit()

    return {"mensaje": "Cliente eliminado de la lista."}


def materializar_segmento(segmento_id: int, db: Session = Depends(get_db)):
    row = obtener_row_segmento(db, segmento_id)

    if row["tipo"] == "estatico":
        return obtener_segmento_dict(db, segmento_id)

    ids = ids_clientes_segmento(db, row)

    db.execute(
        text("DELETE FROM crm_segmento_clientes WHERE organization_id = :organization_id AND segmento_id = :id"),
        {"id": segmento_id, "organization_id": current_organization_id(db)},
    )
    insertar_clientes_segmento(db, segmento_id, ids)

    db.execute(
        text(
            """
            UPDATE crm_segmentos
            SET tipo = 'estatico', filtros_json = NULL, fecha_actualizacion = :fecha
            WHERE organization_id = :organization_id AND id = :id
            """
        ),
        {"id": segmento_id, "organization_id": current_organization_id(db), "fecha": ahora_iso()},
    )
    db.commit()

    return obtener_segmento_dict(db, segmento_id)


def exportar_segmento_csv(segmento_id: int, db: Session = Depends(get_db)):
    row = obtener_row_segmento(db, segmento_id)
    clientes = clientes_de_segmento(db, row, skip=0, limit=1000000)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)

    writer.writerow(
        [
            "id",
            "email",
            "nombre",
            "telefono",
            "sitio_web",
            "direccion",
            "ciudad",
            "sector",
            "categoria_google",
            "latitud",
            "longitud",
            "url_maps",
            "valoracion",
            "num_resenas",
            "fecha_captacion",
        ]
    )

    for c in clientes:
        writer.writerow(
            [
                c.id,
                c.email or "",
                c.nombre or "",
                c.telefono or "",
                c.sitio_web or "",
                c.direccion or "",
                c.ciudad or "",
                c.sector or "",
                c.categoria_google or "",
                c.latitud if c.latitud is not None else "",
                c.longitud if c.longitud is not None else "",
                c.url_maps or "",
                c.valoracion if c.valoracion is not None else "",
                c.num_resenas if c.num_resenas is not None else "",
                c.fecha_captacion.isoformat() if getattr(c, "fecha_captacion", None) else "",
            ]
        )

    contenido = output.getvalue().encode("utf-8-sig")
    output.close()

    filename = nombre_archivo_csv(row["nombre"])

    return StreamingResponse(
        io.BytesIO(contenido),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

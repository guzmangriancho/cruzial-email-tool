import csv
import io
import json
import re
from datetime import datetime
from typing import Any, List, Optional, Tuple
from unicodedata import normalize

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.dependencies import get_db
from backend import models, schemas
from backend.schemas.clientes import ClientesIdsPayload, ClienteUpsertPayload
from backend.utils.tenant import current_organization_id, current_user_id, set_tenant_fields




# ========================================================
# HELPERS DE CREACIÓN / EDICIÓN MANUAL
# ========================================================

def limpiar_texto(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None

    valor_limpio = valor.strip()
    return valor_limpio or None


def normalizar_email(valor: Optional[str]) -> Optional[str]:
    email = limpiar_texto(valor)
    return email.lower() if email else None


def payload_cliente_tiene_datos(payload: ClienteUpsertPayload) -> bool:
    datos = payload.dict()

    for valor in datos.values():
        if isinstance(valor, str) and valor.strip():
            return True

        if valor is not None and not isinstance(valor, str):
            return True

    return False


def comprobar_email_unico(
    db: Session,
    email: Optional[str],
    cliente_id: Optional[int] = None,
    organization_id: Optional[int] = None,
):
    if not email:
        return

    organization_id = organization_id or current_organization_id(db)
    query = db.query(models.Cliente).filter(
        models.Cliente.organization_id == organization_id,
        models.Cliente.email == email,
    )

    if cliente_id is not None:
        query = query.filter(models.Cliente.id != cliente_id)

    existe = query.first()

    if existe:
        raise HTTPException(
            status_code=409,
            detail="Ya existe un cliente con ese email.",
        )


def aplicar_payload_cliente(cliente: models.Cliente, payload: ClienteUpsertPayload):
    cliente.nombre = limpiar_texto(payload.nombre)
    cliente.email = normalizar_email(payload.email)
    cliente.telefono = limpiar_texto(payload.telefono)
    cliente.sitio_web = limpiar_texto(payload.sitio_web)
    cliente.direccion = limpiar_texto(payload.direccion)
    cliente.ciudad = limpiar_texto(payload.ciudad)
    cliente.sector = limpiar_texto(payload.sector)
    cliente.categoria_google = limpiar_texto(payload.categoria_google)
    cliente.url_maps = limpiar_texto(payload.url_maps)

    cliente.latitud = payload.latitud
    cliente.longitud = payload.longitud
    cliente.valoracion = payload.valoracion
    cliente.num_resenas = payload.num_resenas

    if cliente.sector and not cliente.categoria_google:
        cliente.categoria_google = cliente.sector

    return cliente

# ========================================================
# HELPERS DE FILTRO GEOGRÁFICO
# ========================================================

def parsear_poligono(poligono_raw: Optional[str]) -> Optional[List[List[float]]]:
    """
    Recibe el parámetro poligono desde la UI.

    Formato esperado:
    [[lat, lng], [lat, lng], [lat, lng], ...]
    """
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
    """
    Algoritmo ray casting.

    El polígono llega como [[lat, lng], ...].
    Internamente:
    - x = lng
    - y = lat
    """
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



# ========================================================
# HELPERS DE FILTROS / BÚSQUEDA / ORDENACIÓN
# ========================================================

ESTADOS_FILTRO_DATOS = {"todos", "con", "sin"}
ORDENES_PERMITIDOS = {"fecha_captacion", "nombre", "valoracion", "ciudad"}
DIRECCIONES_ORDEN = {"asc", "desc"}


def normalizar_estado_filtro(estado: Optional[str]) -> Optional[str]:
    """
    Convierte el estado recibido desde React a None/con/sin.

    Valores válidos:
    - None o "todos": no filtra
    - "con": exige que el dato exista
    - "sin": exige que el dato falte
    """
    if estado is None or estado == "" or estado == "todos":
        return None

    if estado not in ESTADOS_FILTRO_DATOS:
        raise HTTPException(
            status_code=422,
            detail="Estado de filtro inválido. Usa: todos, con o sin.",
        )

    return estado


def aplicar_filtro_texto(query, columna, estado: Optional[str]):
    estado = normalizar_estado_filtro(estado)

    if estado == "con":
        return query.filter(columna != None).filter(func.trim(columna) != "")

    if estado == "sin":
        return query.filter(or_(columna == None, func.trim(columna) == ""))

    return query


def aplicar_filtro_numero(
    query,
    columna,
    estado: Optional[str],
    cero_cuenta_como_vacio: bool = False,
):
    estado = normalizar_estado_filtro(estado)

    if estado == "con":
        query = query.filter(columna != None)

        if cero_cuenta_como_vacio:
            query = query.filter(columna > 0)

        return query

    if estado == "sin":
        if cero_cuenta_como_vacio:
            return query.filter(or_(columna == None, columna == 0))

        return query.filter(columna == None)

    return query


def columnas_busqueda_general():
    """
    Campos en los que busca el buscador único del CRM.

    Usamos getattr para que el endpoint no rompa si en algún entorno falta
    un campo opcional como termino_busqueda.
    """
    nombres_columnas = [
        "nombre",
        "email",
        "telefono",
        "sitio_web",
        "direccion",
        "ciudad",
        "sector",
        "categoria_google",
        "url_maps",
        "termino_busqueda",
    ]

    return [
        getattr(models.Cliente, nombre)
        for nombre in nombres_columnas
        if hasattr(models.Cliente, nombre)
    ]


def aplicar_busqueda_general(query, busqueda: Optional[str]):
    """
    Búsqueda global.

    Cada palabra escrita debe aparecer en alguno de los campos buscables.
    Ejemplo: "madrid dental" encontrará registros que tengan "madrid"
    en ciudad/dirección/etc. y "dental" en nombre/sector/etc.
    """
    if not busqueda or not busqueda.strip():
        return query

    terminos = [
        termino.strip()
        for termino in re.split(r"\s+", busqueda.strip())
        if termino.strip()
    ]

    columnas = columnas_busqueda_general()

    if not columnas:
        return query

    for termino in terminos:
        patron = f"%{termino}%"
        query = query.filter(or_(*[columna.ilike(patron) for columna in columnas]))

    return query


def obtener_columna_orden(sort_by: Optional[str]):
    campo = sort_by or "fecha_captacion"

    if campo not in ORDENES_PERMITIDOS:
        raise HTTPException(
            status_code=422,
            detail="Orden inválido. Usa: fecha_captacion, nombre, valoracion o ciudad.",
        )

    if campo == "fecha_captacion":
        return models.Cliente.fecha_captacion

    if campo == "nombre":
        return func.lower(models.Cliente.nombre)

    if campo == "valoracion":
        return models.Cliente.valoracion

    if campo == "ciudad":
        return func.lower(models.Cliente.ciudad)

    return models.Cliente.fecha_captacion


def aplicar_orden(query, sort_by: Optional[str], sort_dir: Optional[str]):
    direccion = sort_dir or "desc"

    if direccion not in DIRECCIONES_ORDEN:
        raise HTTPException(
            status_code=422,
            detail="Dirección de orden inválida. Usa: asc o desc.",
        )

    columna = obtener_columna_orden(sort_by)

    orden_principal = columna.asc() if direccion == "asc" else columna.desc()

    # Mantiene los nulos al final de forma compatible con SQLite.
    desempate_id = models.Cliente.id.asc() if direccion == "asc" else models.Cliente.id.desc()

    return query.order_by(columna == None, orden_principal, desempate_id)


def obtener_clientes_filtrados(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    busqueda: Optional[str] = None,
    sector: Optional[str] = None,
    ciudad: Optional[str] = None,
    valoracion_min: Optional[float] = None,
    sort_by: Optional[str] = "fecha_captacion",
    sort_dir: Optional[str] = "desc",
    sin_email: bool = False,
    sin_telefono: bool = False,
    sin_sitio_web: bool = False,
    sin_direccion: bool = False,
    sin_ciudad: bool = False,
    sin_valoracion: bool = False,
    sin_resenas: bool = False,
    sin_url_maps: bool = False,
    email_estado: Optional[str] = None,
    telefono_estado: Optional[str] = None,
    sitio_web_estado: Optional[str] = None,
    direccion_estado: Optional[str] = None,
    ciudad_estado: Optional[str] = None,
    valoracion_estado: Optional[str] = None,
    resenas_estado: Optional[str] = None,
    url_maps_estado: Optional[str] = None,
    poligono: Optional[str] = None,
    paginar: bool = True,
    organization_id: Optional[int] = None,
):
    """
    Aplica todos los filtros de clientes.

    Si paginar=True devuelve solo skip/limit.
    Si paginar=False devuelve todos los resultados filtrados.
    """
    organization_id = organization_id or current_organization_id(db)
    query = db.query(models.Cliente).filter(models.Cliente.organization_id == organization_id)

    query = aplicar_busqueda_general(query, busqueda)

    if sector:
        query = query.filter(models.Cliente.sector == sector)

    # Compatibilidad con el filtro antiguo por ciudad.
    # El frontend nuevo usa busqueda, pero este parámetro sigue funcionando.
    if ciudad:
        query = query.filter(models.Cliente.ciudad.ilike(f"%{ciudad}%"))

    if valoracion_min is not None:
        query = query.filter(models.Cliente.valoracion >= valoracion_min)

    # Compatibilidad con los filtros antiguos "sin_*".
    # Si React envía los nuevos "*_estado", estos tienen prioridad.
    if sin_email and email_estado is None:
        email_estado = "sin"

    if sin_telefono and telefono_estado is None:
        telefono_estado = "sin"

    if sin_sitio_web and sitio_web_estado is None:
        sitio_web_estado = "sin"

    if sin_direccion and direccion_estado is None:
        direccion_estado = "sin"

    if sin_ciudad and ciudad_estado is None:
        ciudad_estado = "sin"

    if sin_valoracion and valoracion_estado is None:
        valoracion_estado = "sin"

    if sin_resenas and resenas_estado is None:
        resenas_estado = "sin"

    if sin_url_maps and url_maps_estado is None:
        url_maps_estado = "sin"

    query = aplicar_filtro_texto(query, models.Cliente.email, email_estado)
    query = aplicar_filtro_texto(query, models.Cliente.telefono, telefono_estado)
    query = aplicar_filtro_texto(query, models.Cliente.sitio_web, sitio_web_estado)
    query = aplicar_filtro_texto(query, models.Cliente.direccion, direccion_estado)
    query = aplicar_filtro_texto(query, models.Cliente.ciudad, ciudad_estado)
    query = aplicar_filtro_texto(query, models.Cliente.url_maps, url_maps_estado)
    query = aplicar_filtro_numero(query, models.Cliente.valoracion, valoracion_estado)
    query = aplicar_filtro_numero(
        query,
        models.Cliente.num_resenas,
        resenas_estado,
        cero_cuenta_como_vacio=True,
    )

    query = aplicar_orden(query, sort_by, sort_dir)

    poligono_coords = parsear_poligono(poligono)

    if poligono_coords:
        lats = [p[0] for p in poligono_coords]
        lngs = [p[1] for p in poligono_coords]

        # Prefiltro SQL por bounding box.
        query = query.filter(models.Cliente.latitud != None)
        query = query.filter(models.Cliente.longitud != None)
        query = query.filter(models.Cliente.latitud >= min(lats))
        query = query.filter(models.Cliente.latitud <= max(lats))
        query = query.filter(models.Cliente.longitud >= min(lngs))
        query = query.filter(models.Cliente.longitud <= max(lngs))

        candidatos = query.all()

        filtrados = [
            cliente
            for cliente in candidatos
            if cliente.latitud is not None
            and cliente.longitud is not None
            and punto_en_poligono(
                cliente.latitud,
                cliente.longitud,
                poligono_coords,
            )
        ]

        if paginar:
            return filtrados[skip: skip + limit]

        return filtrados

    if paginar:
        return query.offset(skip).limit(limit).all()

    return query.all()


# ========================================================
# LISTADO PRINCIPAL
# ========================================================

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
    """
    Devuelve la lista de clientes guardados con filtros avanzados.
    """
    return obtener_clientes_filtrados(
        db=db,
        skip=skip,
        limit=limit,
        busqueda=busqueda,
        sector=sector,
        ciudad=ciudad,
        valoracion_min=valoracion_min,
        sort_by=sort_by,
        sort_dir=sort_dir,
        sin_email=sin_email,
        sin_telefono=sin_telefono,
        sin_sitio_web=sin_sitio_web,
        sin_direccion=sin_direccion,
        sin_ciudad=sin_ciudad,
        sin_valoracion=sin_valoracion,
        sin_resenas=sin_resenas,
        sin_url_maps=sin_url_maps,
        email_estado=email_estado,
        telefono_estado=telefono_estado,
        sitio_web_estado=sitio_web_estado,
        direccion_estado=direccion_estado,
        ciudad_estado=ciudad_estado,
        valoracion_estado=valoracion_estado,
        resenas_estado=resenas_estado,
        url_maps_estado=url_maps_estado,
        poligono=poligono,
        paginar=True,
    )


def crear_cliente_manual(
    payload: ClienteUpsertPayload,
    db: Session = Depends(get_db),
):
    """
    Crea un cliente desde el formulario manual del CRM.

    Permite crear la ficha completa o guardar solo una URL de Google Maps
    para enriquecerla después desde el frontend.
    """
    if not payload_cliente_tiene_datos(payload):
        raise HTTPException(
            status_code=400,
            detail="Rellena al menos un dato del cliente.",
        )

    email = normalizar_email(payload.email)
    comprobar_email_unico(db, email)

    cliente = aplicar_payload_cliente(models.Cliente(), payload)
    set_tenant_fields(cliente, db, creating=True)

    try:
        db.add(cliente)
        db.commit()
        db.refresh(cliente)
        return cliente
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))

# ========================================================
# EXPORTAR CSV
# ========================================================

def _stream_clientes_csv(clientes: List[models.Cliente], filename: str) -> StreamingResponse:
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
            "termino_busqueda",
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
                c.termino_busqueda or "",
                c.fecha_captacion.isoformat() if c.fecha_captacion else "",
            ]
        )

    contenido = output.getvalue().encode("utf-8-sig")
    output.close()

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

    return StreamingResponse(
        io.BytesIO(contenido),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )

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
    """
    Exporta a CSV todos los clientes que coinciden con los filtros actuales.

    Este endpoint no pagina: exporta todos los resultados filtrados.
    """
    clientes = obtener_clientes_filtrados(
        db=db,
        busqueda=busqueda,
        sector=sector,
        ciudad=ciudad,
        valoracion_min=valoracion_min,
        sort_by=sort_by,
        sort_dir=sort_dir,
        sin_telefono=sin_telefono,
        sin_direccion=sin_direccion,
        poligono=poligono,
        paginar=False,
        sin_email=sin_email,
        sin_sitio_web=sin_sitio_web,
        sin_ciudad=sin_ciudad,
        sin_valoracion=sin_valoracion,
        sin_resenas=sin_resenas,
        sin_url_maps=sin_url_maps,
        email_estado=email_estado,
        telefono_estado=telefono_estado,
        sitio_web_estado=sitio_web_estado,
        direccion_estado=direccion_estado,
        ciudad_estado=ciudad_estado,
        valoracion_estado=valoracion_estado,
        resenas_estado=resenas_estado,
        url_maps_estado=url_maps_estado,
    )

    return _stream_clientes_csv(clientes, "clientes_export.csv")


def exportar_clientes_csv_seleccionados(
    payload: ClientesIdsPayload,
    db: Session = Depends(get_db),
):
    """
    Exporta a CSV únicamente los clientes seleccionados en la organización activa.
    """
    ids_unicos = list(dict.fromkeys(payload.ids))

    if not ids_unicos:
        raise HTTPException(status_code=400, detail="No se recibieron IDs para exportar")

    organization_id = current_organization_id(db)
    clientes = (
        db.query(models.Cliente)
        .filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.id.in_(ids_unicos),
        )
        .all()
    )

    clientes_por_id = {cliente.id: cliente for cliente in clientes}
    clientes_ordenados = [clientes_por_id[cliente_id] for cliente_id in ids_unicos if cliente_id in clientes_por_id]

    if not clientes_ordenados:
        raise HTTPException(status_code=404, detail="No se encontró ningún cliente seleccionado para exportar")

    return _stream_clientes_csv(clientes_ordenados, "clientes_seleccionados_export.csv")


# ========================================================
# RUTAS ESTÁTICAS PRIMERO
# ========================================================


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
    """
    Devuelve todos los clientes con coordenadas para pintar el mapa.

    No pagina, pero reutiliza exactamente los mismos filtros del CRM.
    """
    clientes = obtener_clientes_filtrados(
        db=db,
        busqueda=busqueda,
        sector=sector,
        ciudad=ciudad,
        valoracion_min=valoracion_min,
        sort_by=sort_by,
        sort_dir=sort_dir,
        sin_email=sin_email,
        sin_telefono=sin_telefono,
        sin_sitio_web=sin_sitio_web,
        sin_direccion=sin_direccion,
        sin_ciudad=sin_ciudad,
        sin_valoracion=sin_valoracion,
        sin_resenas=sin_resenas,
        sin_url_maps=sin_url_maps,
        email_estado=email_estado,
        telefono_estado=telefono_estado,
        sitio_web_estado=sitio_web_estado,
        direccion_estado=direccion_estado,
        ciudad_estado=ciudad_estado,
        valoracion_estado=valoracion_estado,
        resenas_estado=resenas_estado,
        url_maps_estado=url_maps_estado,
        poligono=poligono,
        paginar=False,
    )

    return [
        {
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
            "fecha_captacion": c.fecha_captacion.isoformat() if c.fecha_captacion else None,
        }
        for c in clientes
        if c.latitud is not None and c.longitud is not None
    ]

def listar_sectores_unicos(db: Session = Depends(get_db)):
    """
    Busca todos los sectores que no estén vacíos y quita duplicados.
    """
    organization_id = current_organization_id(db)
    sectores = (
        db.query(models.Cliente.sector)
        .filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.sector != None,
        )
        .distinct()
        .all()
    )

    return sorted([s[0] for s in sectores if s[0]])


EMAIL_IMPORT_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def _valor_importacion(valor: Any) -> Optional[str]:
    if valor is None:
        return None

    texto = str(valor).strip()

    if not texto:
        return None

    if texto.lower() in {"none", "null", "undefined", "nan", "n/d", "-"}:
        return None

    return texto


def _normalizar_cabecera_csv(texto: Any) -> str:
    texto = str(texto or "").strip().lower()
    texto = normalize("NFKD", texto)
    texto = "".join(c for c in texto if ord(c) < 128)
    return re.sub(r"[^a-z0-9]+", "_", texto).strip("_")


def _valor_fila_csv(row: dict, *cabeceras: str) -> Optional[str]:
    for cabecera in cabeceras:
        clave = _normalizar_cabecera_csv(cabecera)
        valor = row.get(clave)
        if valor is not None and str(valor).strip() != "":
            return str(valor).strip()
    return None


def parsear_clientes_csv_contenido(contenido: bytes) -> Tuple[List[schemas.ClienteImportar], List[str]]:
    """
    Parser CSV de backend para importación directa de archivos.

    Es tolerante con delimitador ; o , y con pequeñas variaciones de cabeceras.
    No valida tipos estrictamente aquí; el servicio de importación se encarga de
    limpiar campo a campo para que una celda mala no tumbe toda la fila.
    """
    avisos: List[str] = []

    texto = contenido.decode("utf-8-sig", errors="replace")
    if not texto.strip():
        return [], ["El CSV está vacío."]

    muestra = texto[:4096]
    try:
        dialect = csv.Sniffer().sniff(muestra, delimiters=";,")
    except Exception:
        dialect = csv.excel
        dialect.delimiter = ";"

    reader = csv.DictReader(io.StringIO(texto), dialect=dialect)
    if not reader.fieldnames:
        return [], ["El CSV no tiene cabeceras."]

    clientes: List[schemas.ClienteImportar] = []

    for fila_idx, row in enumerate(reader, start=2):
        row_norm = {
            _normalizar_cabecera_csv(k): v
            for k, v in row.items()
            if k is not None
        }

        payload = schemas.ClienteImportar(
            id=_valor_fila_csv(row_norm, "id", "cliente_id"),
            email=_valor_fila_csv(row_norm, "email", "correo", "mail", "e_mail"),
            nombre=_valor_fila_csv(row_norm, "nombre", "nombre_empresa", "empresa", "negocio", "entidad", "cliente"),
            telefono=_valor_fila_csv(row_norm, "telefono", "teléfono", "phone", "movil", "móvil"),
            sitio_web=_valor_fila_csv(row_norm, "sitio_web", "web", "website", "url"),
            direccion=_valor_fila_csv(row_norm, "direccion", "dirección", "address"),
            ciudad=_valor_fila_csv(row_norm, "ciudad", "localidad", "municipio"),
            sector=_valor_fila_csv(row_norm, "sector", "actividad"),
            categoria_google=_valor_fila_csv(row_norm, "categoria_google", "categoría_google", "categoria", "categoría", "google_category"),
            latitud=_valor_fila_csv(row_norm, "latitud", "latitude", "lat"),
            longitud=_valor_fila_csv(row_norm, "longitud", "longitude", "lng", "lon"),
            url_maps=_valor_fila_csv(row_norm, "url_maps", "google_maps", "maps", "url_google_maps"),
            valoracion=_valor_fila_csv(row_norm, "valoracion", "valoración", "rating"),
            num_resenas=_valor_fila_csv(row_norm, "num_resenas", "num_reseñas", "resenas", "reseñas", "reviews"),
            termino_busqueda=_valor_fila_csv(row_norm, "termino_busqueda", "término_búsqueda", "busqueda", "búsqueda"),
            fecha_captacion=_valor_fila_csv(row_norm, "fecha_captacion", "fecha_captación", "created_at"),
        )

        # No descartamos aquí por falta de email. La importación decidirá si hay datos útiles.
        clientes.append(payload)

    return clientes, avisos


def _email_importacion(valor: Any, avisos: List[str], fila: int) -> Optional[str]:
    email = _valor_importacion(valor)

    if not email:
        return None

    email = email.lower()

    if not EMAIL_IMPORT_RE.fullmatch(email):
        avisos.append(f"Fila {fila}: email inválido '{email}', se importó sin email.")
        return None

    return email


def _float_importacion(valor: Any, campo: str, avisos: List[str], fila: int) -> Optional[float]:
    texto = _valor_importacion(valor)

    if texto is None:
        return None

    try:
        return float(texto.replace(",", "."))
    except Exception:
        avisos.append(f"Fila {fila}: {campo} inválido '{texto}', se dejó vacío.")
        return None


def _int_importacion(valor: Any, campo: str, avisos: List[str], fila: int) -> Optional[int]:
    texto = _valor_importacion(valor)

    if texto is None:
        return None

    try:
        return int(float(texto.replace(",", ".")))
    except Exception:
        avisos.append(f"Fila {fila}: {campo} inválido '{texto}', se dejó vacío.")
        return None


def _fecha_importacion(valor: Any, avisos: List[str], fila: int) -> Optional[datetime]:
    texto = _valor_importacion(valor)

    if texto is None:
        return None

    try:
        normalizado = texto.replace("Z", "+00:00")
        fecha = datetime.fromisoformat(normalizado)
        if fecha.tzinfo is not None:
            fecha = fecha.replace(tzinfo=None)
        return fecha
    except Exception:
        avisos.append(f"Fila {fila}: fecha_captacion inválida '{texto}', se usó la fecha actual.")
        return None


def _datos_cliente_importacion(c: schemas.ClienteImportar, fila: int, avisos: List[str]) -> dict:
    sector = _valor_importacion(c.sector)
    categoria_google = _valor_importacion(c.categoria_google) or sector

    return {
        "nombre": _valor_importacion(c.nombre),
        "email": _email_importacion(c.email, avisos, fila),
        "telefono": _valor_importacion(c.telefono),
        "sitio_web": _valor_importacion(c.sitio_web),
        "direccion": _valor_importacion(c.direccion),
        "ciudad": _valor_importacion(c.ciudad),
        "sector": sector,
        "categoria_google": categoria_google,
        "latitud": _float_importacion(c.latitud, "latitud", avisos, fila),
        "longitud": _float_importacion(c.longitud, "longitud", avisos, fila),
        "url_maps": _valor_importacion(c.url_maps),
        "valoracion": _float_importacion(c.valoracion, "valoracion", avisos, fila),
        "num_resenas": _int_importacion(c.num_resenas, "num_resenas", avisos, fila),
        "termino_busqueda": _valor_importacion(c.termino_busqueda),
        "fecha_captacion": _fecha_importacion(c.fecha_captacion, avisos, fila),
    }


def _tiene_dato_util(datos: dict) -> bool:
    campos_minimos = [
        "nombre",
        "email",
        "telefono",
        "sitio_web",
        "direccion",
        "ciudad",
        "sector",
        "url_maps",
    ]
    return any(datos.get(campo) not in (None, "") for campo in campos_minimos)


def _buscar_cliente_importacion(db: Session, organization_id: int, datos: dict) -> Optional[models.Cliente]:
    """
    Busca duplicados dentro de la organización, nunca globalmente.
    Orden de fiabilidad: email -> url_maps -> sitio_web.
    """
    email = datos.get("email")
    if email:
        existe = (
            db.query(models.Cliente)
            .filter(
                models.Cliente.organization_id == organization_id,
                models.Cliente.email == email,
            )
            .first()
        )
        if existe:
            return existe

    url_maps = datos.get("url_maps")
    if url_maps:
        existe = (
            db.query(models.Cliente)
            .filter(
                models.Cliente.organization_id == organization_id,
                models.Cliente.url_maps == url_maps,
            )
            .first()
        )
        if existe:
            return existe

    sitio_web = datos.get("sitio_web")
    if sitio_web:
        existe = (
            db.query(models.Cliente)
            .filter(
                models.Cliente.organization_id == organization_id,
                models.Cliente.sitio_web == sitio_web,
            )
            .first()
        )
        if existe:
            return existe

    return None


def _aplicar_datos_importacion(cliente: models.Cliente, datos: dict) -> None:
    """
    Actualiza solo datos útiles. No pisa datos existentes con None/cadena vacía.
    """
    for campo, valor in datos.items():
        if valor is None or valor == "":
            continue
        setattr(cliente, campo, valor)


def importar_clientes_csv(
    clientes: List[schemas.ClienteImportar],
    db: Session = Depends(get_db),
):
    """
    Importación masiva tolerante.

    Objetivos:
    - Importar todos los campos conocidos del CSV.
    - No descartar una fila completa porque falle un campo concreto.
    - Crear clientes sin email si tienen otros datos útiles.
    - Actualizar clientes existentes dentro de la misma organización por email, url_maps o sitio_web.
    - No permitir que un error de una fila impida importar las demás.
    """
    organization_id = current_organization_id(db)
    user_id = current_user_id(db)

    creados = 0
    actualizados = 0
    omitidos = 0
    errores: List[str] = []
    avisos: List[str] = []

    print("--------------------------------------------------")
    print("[DEBUG] POST recibido en /importacion_masiva")
    print(f"[DEBUG] Número de registros recibidos desde React: {len(clientes)}")

    for indice, cliente_payload in enumerate(clientes, start=1):
        fila_csv = indice + 1  # fila 1 = cabeceras

        try:
            datos = _datos_cliente_importacion(cliente_payload, fila_csv, avisos)

            if not _tiene_dato_util(datos):
                omitidos += 1
                avisos.append(f"Fila {fila_csv}: sin datos útiles. Omitida.")
                continue

            existente = _buscar_cliente_importacion(db, organization_id, datos)

            if existente:
                _aplicar_datos_importacion(existente, datos)
                existente.updated_by_user_id = user_id
                db.commit()
                actualizados += 1
                continue

            nuevo_cliente = models.Cliente(
                organization_id=organization_id,
                created_by_user_id=user_id,
                **{campo: valor for campo, valor in datos.items() if valor is not None and valor != ""},
            )

            db.add(nuevo_cliente)
            db.commit()
            creados += 1

        except Exception as exc:
            db.rollback()
            omitidos += 1
            errores.append(f"Fila {fila_csv}: {exc}")
            continue

    total_procesados = len(clientes)
    print(
        f"[DEBUG] Importación finalizada. Procesados={total_procesados}, "
        f"creados={creados}, actualizados={actualizados}, omitidos={omitidos}"
    )
    print("--------------------------------------------------")

    mensaje = f"Importación completada: {creados} creados, {actualizados} actualizados, {omitidos} omitidos."

    return {
        "mensaje": mensaje,
        "procesados": total_procesados,
        "creados": creados,
        "actualizados": actualizados,
        "omitidos": omitidos,
        "avisos": avisos[:100],
        "errores": errores[:100],
    }


def importar_clientes_csv_archivo(
    contenido: bytes,
    filename: Optional[str] = None,
    db: Session = Depends(get_db),
):
    clientes, avisos_parseo = parsear_clientes_csv_contenido(contenido)

    if not clientes:
        return {
            "mensaje": "No se encontraron filas importables en el CSV.",
            "procesados": 0,
            "creados": 0,
            "actualizados": 0,
            "omitidos": 0,
            "avisos": avisos_parseo,
            "errores": [],
        }

    resultado = importar_clientes_csv(clientes=clientes, db=db)
    resultado["avisos"] = [*avisos_parseo, *resultado.get("avisos", [])][:100]
    return resultado

def obtener_ids_pendientes(db: Session = Depends(get_db)):
    """
    Devuelve la lista de IDs de clientes a los que les falta teléfono o dirección.
    También considera vacío "" como dato faltante.
    """
    organization_id = current_organization_id(db)
    clientes = (
        db.query(models.Cliente.id)
        .filter(
            models.Cliente.organization_id == organization_id,
            or_(
                models.Cliente.telefono == None,
                models.Cliente.telefono == "",
                models.Cliente.direccion == None,
                models.Cliente.direccion == "",
            )
        )
        .all()
    )

    return [c[0] for c in clientes]


def limpiar_base_datos(db: Session = Depends(get_db)):
    """
    Limpia nombres y elimina correos duplicados, dejando el registro con más datos útiles.
    """
    organization_id = current_organization_id(db)
    clientes = db.query(models.Cliente).filter(models.Cliente.organization_id == organization_id).all()

    nombres_corregidos = 0
    duplicados_borrados = 0

    for c in clientes:
        if c.nombre:
            nombre_limpio = re.sub(r'[*"\'_¡!¿?|]', "", c.nombre).strip()
            nombre_limpio = re.sub(r"\s+", " ", nombre_limpio)

            if nombre_limpio != c.nombre:
                c.nombre = nombre_limpio
                nombres_corregidos += 1

        if c.email:
            c.email = c.email.strip().lower()

        if c.sector and not c.categoria_google:
            c.categoria_google = c.sector

    db.commit()

    clientes_actualizados = db.query(models.Cliente).filter(models.Cliente.organization_id == organization_id).all()
    mejores_clientes = {}

    for c in clientes_actualizados:
        if not c.email:
            continue

        if c.email not in mejores_clientes:
            mejores_clientes[c.email] = c
            continue

        existente = mejores_clientes[c.email]

        puntos_existente = sum(
            [
                bool(existente.telefono),
                bool(existente.direccion),
                bool(existente.valoracion),
                bool(existente.num_resenas),
                bool(existente.latitud),
                bool(existente.longitud),
                bool(existente.sitio_web),
            ]
        )

        puntos_nuevo = sum(
            [
                bool(c.telefono),
                bool(c.direccion),
                bool(c.valoracion),
                bool(c.num_resenas),
                bool(c.latitud),
                bool(c.longitud),
                bool(c.sitio_web),
            ]
        )

        if puntos_nuevo > puntos_existente:
            db.delete(existente)
            mejores_clientes[c.email] = c
            duplicados_borrados += 1
        else:
            db.delete(c)
            duplicados_borrados += 1

    db.commit()

    return {
        "mensaje": (
            "Limpieza completada.\n"
            f"- Nombres corregidos: {nombres_corregidos}\n"
            f"- Duplicados eliminados: {duplicados_borrados}"
        )
    }


def eliminar_clientes_masivo(
    payload: ClientesIdsPayload,
    db: Session = Depends(get_db),
):
    """
    Elimina varios clientes seleccionados desde el CRM.
    """
    ids_unicos = list(dict.fromkeys(payload.ids))

    if not ids_unicos:
        raise HTTPException(status_code=400, detail="No se recibieron IDs para eliminar")

    organization_id = current_organization_id(db)
    clientes = (
        db.query(models.Cliente)
        .filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.id.in_(ids_unicos),
        )
        .all()
    )

    if not clientes:
        return {"mensaje": "No se encontró ningún cliente para eliminar.", "eliminados": 0}

    eliminados = len(clientes)

    for cliente in clientes:
        db.delete(cliente)

    db.commit()

    return {
        "mensaje": f"Se han eliminado {eliminados} clientes correctamente.",
        "eliminados": eliminados,
    }


# ========================================================
# RUTAS DINÁMICAS DESPUÉS
# ========================================================


def actualizar_cliente_manual(
    cliente_id: int,
    payload: ClienteUpsertPayload,
    db: Session = Depends(get_db),
):
    """
    Actualiza manualmente todos los campos editables de un cliente.
    """
    organization_id = current_organization_id(db)
    cliente = (
        db.query(models.Cliente)
        .filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.id == cliente_id,
        )
        .first()
    )

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    email = normalizar_email(payload.email)
    comprobar_email_unico(db, email, cliente_id=cliente_id, organization_id=current_organization_id(db))

    aplicar_payload_cliente(cliente, payload)
    set_tenant_fields(cliente, db, creating=False)

    try:
        db.commit()
        db.refresh(cliente)
        return cliente
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """
    Devuelve todos los detalles de un cliente específico buscando por su ID.
    """
    organization_id = current_organization_id(db)
    cliente = (
        db.query(models.Cliente)
        .filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.id == cliente_id,
        )
        .first()
    )

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    return cliente


def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """
    Elimina un cliente de la base de datos.
    """
    organization_id = current_organization_id(db)
    cliente = (
        db.query(models.Cliente)
        .filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.id == cliente_id,
        )
        .first()
    )

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    nombre = cliente.nombre
    db.delete(cliente)
    db.commit()

    return {"mensaje": f"Cliente '{nombre}' eliminado correctamente."}

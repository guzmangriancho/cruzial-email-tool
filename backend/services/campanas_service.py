import csv
import io
import json
import re
import shutil
import tempfile
import time
import uuid
from datetime import datetime
from html import escape
from pathlib import Path
from types import SimpleNamespace
from typing import Dict, List, Optional, Tuple
from unicodedata import normalize

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.dependencies import get_db
from backend import models, mailer, schemas
from backend.services import organizacion_smtp_service
from backend.utils.tenant import current_organization_id, current_user_id, set_tenant_fields



# Estado en memoria para progreso en tiempo real.
# La fuente de verdad sigue siendo la BD: campanas + envios_log.
ESTADO_ENVIOS: Dict[str, dict] = {}

# Carpetas de adjuntos.
# /adjuntos_genericos: archivos reutilizables, visibles desde la UI.
# /adjuntos_campanas: copias de archivos subidos para cada campaña.
BASE_DIR = Path(__file__).resolve().parent.parent
ADJUNTOS_GENERICOS_DIR = Path(mailer.CARPETA_ADJUNTOS)
ADJUNTOS_CAMPANAS_DIR = BASE_DIR / "adjuntos_campanas"


# ========================================================
# DB
# ========================================================



# ========================================================
# HELPERS
# ========================================================

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def ahora_str() -> str:
    return time.strftime("%H:%M:%S")


def normalizar_clave(texto: str) -> str:
    texto = (texto or "").strip().lower()
    texto = normalize("NFKD", texto)
    texto = "".join(c for c in texto if not ord(c) > 127)
    texto = re.sub(r"[^a-z0-9]+", "_", texto)
    return texto.strip("_")


def email_valido(email: Optional[str]) -> bool:
    return bool(email and EMAIL_RE.fullmatch(email.strip()))


def safe_int(valor, default: Optional[int] = None) -> Optional[int]:
    try:
        if valor is None or valor == "":
            return default
        return int(valor)
    except Exception:
        return default


def limpiar_texto(valor) -> Optional[str]:
    if valor is None:
        return None

    texto = str(valor).strip()

    if not texto:
        return None

    return texto




def parsear_lista_json(valor: str) -> List[str]:
    """
    Recibe un JSON tipo ["dossier.pdf", "tarifa.pdf"] desde FormData.
    Devuelve nombres de archivo seguros, sin rutas.
    """
    try:
        data = json.loads(valor or "[]")
    except Exception:
        return []

    if not isinstance(data, list):
        return []

    nombres: List[str] = []

    for item in data:
        nombre = nombre_archivo_seguro(str(item))
        if nombre:
            nombres.append(nombre)

    # Mantener orden eliminando duplicados.
    return list(dict.fromkeys(nombres))


def nombre_archivo_seguro(nombre: str) -> str:
    """
    Evita path traversal. Si llega "../../x.pdf", se queda solo con "x.pdf".
    """
    nombre = Path(nombre or "").name.strip()

    if not nombre or nombre in {".", ".."}:
        return ""

    return nombre


def resolver_adjuntos_genericos(
    nombres: List[str],
    fallar_si_no_existe: bool = True,
) -> List[Path]:
    """
    Convierte nombres de /adjuntos_genericos en rutas reales.
    """
    ADJUNTOS_GENERICOS_DIR.mkdir(parents=True, exist_ok=True)

    rutas: List[Path] = []

    for nombre in nombres:
        nombre_seguro = nombre_archivo_seguro(nombre)

        if not nombre_seguro:
            continue

        ruta = ADJUNTOS_GENERICOS_DIR / nombre_seguro

        if not ruta.exists() or not ruta.is_file():
            if fallar_si_no_existe:
                raise HTTPException(
                    status_code=400,
                    detail=f"El adjunto genérico no existe: {nombre_seguro}",
                )
            continue

        rutas.append(ruta)

    return rutas


def carpeta_adjuntos_campana(campana_id: int, organization_id: int | None = None) -> Path:
    org_id = organization_id or 1
    return ADJUNTOS_CAMPANAS_DIR / f"org_{org_id}" / f"campana_{campana_id}"


def guardar_upload_file(
    upload: UploadFile,
    carpeta: Path,
    usados: set[str],
) -> Optional[str]:
    """
    Guarda un UploadFile evitando sobrescribir archivos con el mismo nombre.
    Devuelve el nombre final guardado.
    """
    nombre_original = nombre_archivo_seguro(upload.filename or "")

    if not nombre_original:
        nombre_original = f"adjunto_{uuid.uuid4().hex}.bin"

    stem = Path(nombre_original).stem or "adjunto"
    suffix = Path(nombre_original).suffix

    nombre_final = nombre_original
    contador = 2

    while nombre_final in usados or (carpeta / nombre_final).exists():
        nombre_final = f"{stem}_{contador}{suffix}"
        contador += 1

    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / nombre_final

    try:
        upload.file.seek(0)
    except Exception:
        pass

    with destino.open("wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)

    usados.add(nombre_final)

    return nombre_final


def guardar_adjuntos_campana(
    campana_id: int,
    adjuntos_genericos_json: str,
    adjuntos_upload: Optional[List[UploadFile]],
    organization_id: int | None = None,
) -> dict:
    """
    Guarda en disco la selección de adjuntos de una campaña.
    No requiere migraciones de BD.
    """
    genericos = parsear_lista_json(adjuntos_genericos_json)
    resolver_adjuntos_genericos(genericos, fallar_si_no_existe=True)

    carpeta = carpeta_adjuntos_campana(campana_id, organization_id=organization_id)
    uploads_dir = carpeta / "uploads"
    uploads_guardados: List[str] = []
    usados: set[str] = set()

    for upload in adjuntos_upload or []:
        nombre_guardado = guardar_upload_file(upload, uploads_dir, usados)

        if nombre_guardado:
            uploads_guardados.append(nombre_guardado)

    metadata = {
        "campana_id": campana_id,
        "genericos": genericos,
        "uploads": uploads_guardados,
    }

    if genericos or uploads_guardados:
        carpeta.mkdir(parents=True, exist_ok=True)
        (carpeta / "adjuntos.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    return metadata


def obtener_rutas_adjuntos_campana(campana_id: int, organization_id: int | None = None) -> List[Path]:
    """
    Lee los adjuntos guardados para una campaña y devuelve rutas existentes.
    Si no hay adjuntos, devuelve [].
    """
    carpeta = carpeta_adjuntos_campana(campana_id, organization_id=organization_id)
    metadata_path = carpeta / "adjuntos.json"

    if not metadata_path.exists():
        return []

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    genericos = [
        nombre_archivo_seguro(nombre)
        for nombre in metadata.get("genericos", [])
        if nombre_archivo_seguro(nombre)
    ]

    rutas = resolver_adjuntos_genericos(genericos, fallar_si_no_existe=False)

    uploads_dir = carpeta / "uploads"

    for nombre in metadata.get("uploads", []):
        nombre_seguro = nombre_archivo_seguro(str(nombre))

        if not nombre_seguro:
            continue

        ruta = uploads_dir / nombre_seguro

        if ruta.exists() and ruta.is_file():
            rutas.append(ruta)

    return rutas


def guardar_uploads_temporales(
    adjuntos_upload: Optional[List[UploadFile]],
    carpeta: Path,
) -> List[Path]:
    rutas: List[Path] = []
    usados: set[str] = set()

    for upload in adjuntos_upload or []:
        nombre_guardado = guardar_upload_file(upload, carpeta, usados)

        if nombre_guardado:
            rutas.append(carpeta / nombre_guardado)

    return rutas


def cliente_prueba_para(email_destino: str):
    """
    Cliente ficticio para renderizar variables en el correo de prueba.
    """
    return SimpleNamespace(
        nombre="Cliente de prueba",
        email=email_destino,
        telefono="942 03 34 04",
        sitio_web="https://www.cruzialpublicidad.com",
        direccion="Bº La Yesera, 51 - nave 1",
        ciudad="Parbayón",
        sector="Publicidad",
        categoria_google="Publicidad",
    )


def get_row_value(row_norm: dict, *posibles: str) -> Optional[str]:
    for posible in posibles:
        clave = normalizar_clave(posible)
        valor = row_norm.get(clave)
        if valor is not None and str(valor).strip() != "":
            return str(valor).strip()
    return None


def parsear_csv_clientes(contenido: bytes) -> Tuple[List[dict], List[str]]:
    """
    Lee CSV con cabeceras.
    Soporta delimitador ; o ,.
    Columnas recomendadas:
    id,email,nombre,telefono,sitio_web,direccion,ciudad,sector,latitud,longitud
    """
    errores: List[str] = []

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

    filas: List[dict] = []

    for idx, row in enumerate(reader, start=2):
        row_norm = {normalizar_clave(k): v for k, v in row.items() if k is not None}

        email = get_row_value(row_norm, "email", "correo", "mail", "e_mail")
        cliente_id = get_row_value(row_norm, "id", "cliente_id", "cliente")

        if not cliente_id and not email:
            errores.append(f"Fila {idx}: sin id ni email. Omitida.")
            continue

        if email:
            email = email.strip().lower()
            if not email_valido(email):
                errores.append(f"Fila {idx}: email inválido '{email}'. Omitida.")
                continue

        nombre = get_row_value(
            row_norm,
            "nombre",
            "nombre_empresa",
            "empresa",
            "negocio",
            "entidad",
            "cliente",
        )

        filas.append({
            "cliente_id": safe_int(cliente_id),
            "email": email,
            "nombre": nombre,
            "telefono": get_row_value(row_norm, "telefono", "teléfono", "phone"),
            "sitio_web": get_row_value(row_norm, "sitio_web", "web", "website", "url"),
            "direccion": get_row_value(row_norm, "direccion", "dirección", "address"),
            "ciudad": get_row_value(row_norm, "ciudad", "localidad", "municipio"),
            "sector": get_row_value(row_norm, "sector", "categoria", "categoría", "categoria_google"),
            "latitud": get_row_value(row_norm, "latitud", "lat"),
            "longitud": get_row_value(row_norm, "longitud", "lng", "lon"),
            "url_maps": get_row_value(row_norm, "url_maps", "google_maps", "maps"),
        })

    return filas, errores


def float_o_none(valor) -> Optional[float]:
    try:
        if valor is None or str(valor).strip() == "":
            return None

        return float(str(valor).replace(",", "."))
    except Exception:
        return None


def obtener_o_crear_cliente_desde_csv(db: Session, fila: dict, organization_id: int | None = None, user_id: int | None = None) -> Optional[models.Cliente]:
    """
    Si viene id y existe, usa ese cliente.
    Si no, busca por email.
    Si no existe, crea cliente nuevo con los datos del CSV.
    """
    organization_id = organization_id or current_organization_id(db)
    user_id = user_id if user_id is not None else current_user_id(db)
    cliente = None

    if fila.get("cliente_id"):
        cliente = (
            db.query(models.Cliente)
            .filter(models.Cliente.organization_id == organization_id, models.Cliente.id == fila["cliente_id"])
            .first()
        )

    if not cliente and fila.get("email"):
        cliente = (
            db.query(models.Cliente)
            .filter(models.Cliente.organization_id == organization_id, models.Cliente.email == fila["email"])
            .first()
        )

    if cliente:
        # Rellenar huecos sin pisar datos existentes buenos.
        for campo in [
            "nombre",
            "telefono",
            "sitio_web",
            "direccion",
            "ciudad",
            "sector",
            "url_maps",
        ]:
            valor = limpiar_texto(fila.get(campo))
            if valor and not getattr(cliente, campo):
                setattr(cliente, campo, valor)

        if fila.get("sector") and not cliente.categoria_google:
            cliente.categoria_google = fila["sector"]

        lat = float_o_none(fila.get("latitud"))
        lng = float_o_none(fila.get("longitud"))

        if lat is not None and cliente.latitud is None:
            cliente.latitud = lat

        if lng is not None and cliente.longitud is None:
            cliente.longitud = lng

        return cliente

    if not fila.get("email"):
        return None

    nombre = limpiar_texto(fila.get("nombre")) or fila["email"].split("@")[0]
    sector = limpiar_texto(fila.get("sector"))

    cliente = models.Cliente(
        organization_id=organization_id,
        created_by_user_id=user_id,
        nombre=nombre,
        email=fila["email"],
        telefono=limpiar_texto(fila.get("telefono")),
        sitio_web=limpiar_texto(fila.get("sitio_web")),
        direccion=limpiar_texto(fila.get("direccion")),
        ciudad=limpiar_texto(fila.get("ciudad")),
        sector=sector,
        categoria_google=sector,
        latitud=float_o_none(fila.get("latitud")),
        longitud=float_o_none(fila.get("longitud")),
        url_maps=limpiar_texto(fila.get("url_maps")),
    )

    db.add(cliente)
    db.flush()

    return cliente


def crear_estado_task(task_id: str, campana_id: int, organization_id: int | None = None):
    ESTADO_ENVIOS[task_id] = {
        "organization_id": organization_id or 1,
        "task_id": task_id,
        "campana_id": campana_id,
        "total": 0,
        "pendientes": 0,
        "enviados": 0,
        "errores": 0,
        "omitidos": 0,
        "procesados": 0,
        "finalizado": False,
        "detener": False,
        "estado": "Iniciando",
        "mensaje": "Preparando campaña...",
        "log_actividad": [],
    }


def log_task(task_id: str, mensaje: str):
    estado = ESTADO_ENVIOS.get(task_id)

    if not estado:
        return

    estado.setdefault("log_actividad", [])
    estado["log_actividad"].insert(0, f"[{ahora_str()}] {mensaje}")
    estado["log_actividad"] = estado["log_actividad"][:200]


def resumen_campana_db(db: Session, campana_id: int, organization_id: int | None = None) -> dict:
    organization_id = organization_id or current_organization_id(db)
    campana = db.query(models.Campana).filter(
        models.Campana.organization_id == organization_id,
        models.Campana.id == campana_id,
    ).first()

    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")

    conteos_raw = (
        db.query(models.EnvioLog.estado, func.count(models.EnvioLog.id))
        .filter(
            models.EnvioLog.organization_id == organization_id,
            models.EnvioLog.campana_id == campana_id,
        )
        .group_by(models.EnvioLog.estado)
        .all()
    )

    conteos = {estado: cantidad for estado, cantidad in conteos_raw}
    total = sum(conteos.values())

    enviados = conteos.get("Éxito", 0)
    errores = conteos.get("Error", 0)
    omitidos = conteos.get("Omitido", 0)
    pendientes = conteos.get("Pendiente", 0) + conteos.get("Enviando", 0)
    procesados = enviados + errores + omitidos

    return {
        "campana_id": campana.id,
        "id": campana.id,
        "public_id": campana.public_id,
        "campana_public_id": campana.public_id,
        "nombre": campana.nombre,
        "estado": campana.estado,
        "total": total,
        "pendientes": pendientes,
        "enviados": enviados,
        "errores": errores,
        "omitidos": omitidos,
        "procesados": procesados,
        "finalizado": campana.estado in ["Completada", "Error"],
        "fecha_creacion": campana.fecha_creacion.isoformat() if campana.fecha_creacion else None,
        "fecha_inicio": campana.fecha_inicio.isoformat() if campana.fecha_inicio else None,
        "fecha_fin": campana.fecha_fin.isoformat() if campana.fecha_fin else None,
        "remitente": campana.remitente,
        "delay_segundos": campana.delay_segundos,
    }


VARIABLES = {
    "nombre": lambda c: c.nombre,
    "nombre_empresa": lambda c: c.nombre,
    "empresa": lambda c: c.nombre,
    "email": lambda c: c.email,
    "correo": lambda c: c.email,
    "telefono": lambda c: c.telefono,
    "ciudad": lambda c: c.ciudad,
    "direccion": lambda c: c.direccion,
    "sector": lambda c: c.sector or c.categoria_google,
    "categoria": lambda c: c.categoria_google or c.sector,
    "sitio_web": lambda c: c.sitio_web,
    "web": lambda c: c.sitio_web,
}


def obtener_variable(cliente: models.Cliente, nombre_var: str) -> str:
    clave = normalizar_clave(nombre_var)
    fn = VARIABLES.get(clave)

    if not fn:
        return ""

    valor = fn(cliente)

    return escape(str(valor)) if valor is not None else ""


def renderizar_plantilla(texto: str, cliente: models.Cliente) -> str:
    """
    Soporta:
    - {{nombre}}
    - {{ciudad}}
    - <nombre empresa>
    - &lt;nombre empresa&gt;
    """
    if not texto:
        return ""

    def repl_mustache(match):
        return obtener_variable(cliente, match.group(1))

    def repl_tag(match):
        return obtener_variable(cliente, match.group(1))

    texto = re.sub(r"\{\{\s*([^}]+?)\s*\}\}", repl_mustache, texto)
    texto = re.sub(r"&lt;\s*([^&<>]+?)\s*&gt;", repl_tag, texto)
    texto = re.sub(r"<\s*(nombre empresa|nombre|ciudad|sector|email|correo|telefono|direccion|web|sitio web)\s*>", repl_tag, texto, flags=re.I)

    return texto


# ========================================================
# PROCESAMIENTO EN SEGUNDO PLANO
# ========================================================

def procesar_campana(task_id: str, campana_id: int):
    db = SessionLocal()

    try:
        existing_state = ESTADO_ENVIOS.get(task_id, {})
        organization_id = existing_state.get("organization_id") or 1
        crear_estado_task(task_id, campana_id, organization_id=organization_id)

        campana = db.query(models.Campana).filter(
            models.Campana.organization_id == organization_id,
            models.Campana.id == campana_id,
        ).first()

        if not campana:
            ESTADO_ENVIOS[task_id]["estado"] = "Error"
            ESTADO_ENVIOS[task_id]["mensaje"] = "Campaña no encontrada."
            ESTADO_ENVIOS[task_id]["finalizado"] = True
            return

        if not campana.plantilla:
            campana.estado = "Error"
            db.commit()
            ESTADO_ENVIOS[task_id]["estado"] = "Error"
            ESTADO_ENVIOS[task_id]["mensaje"] = "La campaña no tiene plantilla."
            ESTADO_ENVIOS[task_id]["finalizado"] = True
            return

        campana.estado = "En Progreso"
        if not campana.fecha_inicio:
            campana.fecha_inicio = datetime.utcnow()
        db.commit()

        log_task(task_id, f"🚀 Campaña iniciada: {campana.nombre}")

        delay = campana.delay_segundos or 30
        rutas_adjuntos_campana = obtener_rutas_adjuntos_campana(campana_id, organization_id=organization_id)
        smtp_settings = organizacion_smtp_service.get_send_settings(db, organization_id)

        while True:
            if ESTADO_ENVIOS.get(task_id, {}).get("detener"):
                campana.estado = "Pausada"
                db.commit()
                ESTADO_ENVIOS[task_id]["estado"] = "Pausada"
                ESTADO_ENVIOS[task_id]["mensaje"] = "Campaña pausada por el usuario."
                ESTADO_ENVIOS[task_id]["finalizado"] = False
                log_task(task_id, "⏸️ Campaña pausada.")
                return

            resumen = resumen_campana_db(db, campana_id, organization_id=organization_id)
            ESTADO_ENVIOS[task_id].update(resumen)

            envio = (
                db.query(models.EnvioLog)
                .filter(
                    models.EnvioLog.organization_id == organization_id,
                    models.EnvioLog.campana_id == campana_id,
                    models.EnvioLog.estado == "Pendiente",
                )
                .order_by(models.EnvioLog.id.asc())
                .first()
            )

            if not envio:
                campana.estado = "Completada"
                campana.fecha_fin = datetime.utcnow()
                db.commit()

                resumen = resumen_campana_db(db, campana_id, organization_id=organization_id)
                ESTADO_ENVIOS[task_id].update(resumen)
                ESTADO_ENVIOS[task_id]["estado"] = "Completada"
                ESTADO_ENVIOS[task_id]["mensaje"] = "Campaña completada."
                ESTADO_ENVIOS[task_id]["finalizado"] = True
                log_task(task_id, "🏁 Campaña completada.")
                return

            cliente = envio.cliente

            if not cliente or not cliente.email:
                envio.estado = "Omitido"
                envio.detalle_error = "Cliente sin email."
                envio.fecha_envio = datetime.utcnow()
                envio.intentos = (envio.intentos or 0) + 1
                db.commit()
                log_task(task_id, f"⚠️ Omitido envío {envio.id}: cliente sin email.")
                continue

            envio.estado = "Enviando"
            envio.intentos = (envio.intentos or 0) + 1
            db.commit()

            asunto = renderizar_plantilla(campana.plantilla.asunto, cliente)
            cuerpo_html = renderizar_plantilla(campana.plantilla.cuerpo_html, cliente)

            log_task(task_id, f"✉️ Enviando a {cliente.email}...")

            exito, detalle = mailer.enviar_correo(
                destinatario=cliente.email,
                asunto=asunto,
                cuerpo_html_base=cuerpo_html,
                nombre_remitente=campana.remitente or smtp_settings.from_name or "Grupo Publicitario Cruzial",
                rutas_adjuntos=rutas_adjuntos_campana,
                smtp_config=smtp_settings,
            )

            envio.fecha_envio = datetime.utcnow()
            envio.estado = "Éxito" if exito else "Error"
            envio.detalle_error = None if exito else detalle
            db.commit()

            if exito:
                log_task(task_id, f"✅ Enviado a {cliente.email}")
            else:
                log_task(task_id, f"❌ Error con {cliente.email}: {detalle[:120]}")

            resumen = resumen_campana_db(db, campana_id, organization_id=organization_id)
            ESTADO_ENVIOS[task_id].update(resumen)

            # Pausa entre envíos, pero comprobando parada cada segundo.
            for _ in range(max(0, delay)):
                if ESTADO_ENVIOS.get(task_id, {}).get("detener"):
                    break
                time.sleep(1)

    except Exception as e:
        try:
            organization_id = ESTADO_ENVIOS.get(task_id, {}).get("organization_id") or 1
            campana = db.query(models.Campana).filter(
                models.Campana.organization_id == organization_id,
                models.Campana.id == campana_id,
            ).first()
            if campana:
                campana.estado = "Error"
                db.commit()
        except Exception:
            db.rollback()

        detalle_error = getattr(e, "detail", None) or str(e) or "Error desconocido"
        if task_id in ESTADO_ENVIOS:
            ESTADO_ENVIOS[task_id]["estado"] = "Error"
            ESTADO_ENVIOS[task_id]["mensaje"] = f"Error fatal: {detalle_error}"
            ESTADO_ENVIOS[task_id]["finalizado"] = True
            log_task(task_id, f"❌ Error fatal: {detalle_error}")

    finally:
        db.close()


def arrancar_task_campana(background_tasks: BackgroundTasks, campana_id: int, organization_id: int | None = None) -> str:
    task_id = str(uuid.uuid4())
    crear_estado_task(task_id, campana_id, organization_id=organization_id)
    background_tasks.add_task(procesar_campana, task_id, campana_id)
    return task_id


# ========================================================
# ENDPOINTS
# ========================================================

def listar_campanas(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    organization_id = current_organization_id(db)
    campanas = (
        db.query(models.Campana)
        .filter(models.Campana.organization_id == organization_id)
        .order_by(models.Campana.fecha_creacion.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    resultado = []

    for campana in campanas:
        resumen = resumen_campana_db(db, campana.id, organization_id=organization_id)
        resultado.append(resumen)

    return resultado


def listar_adjuntos_disponibles():
    """
    Lista los archivos disponibles en /adjuntos_genericos.
    """
    ADJUNTOS_GENERICOS_DIR.mkdir(parents=True, exist_ok=True)

    adjuntos = []

    for ruta in sorted(ADJUNTOS_GENERICOS_DIR.iterdir(), key=lambda p: p.name.lower()):
        if not ruta.is_file():
            continue

        # El logo corporativo se usa inline en la firma; no debe aparecer como
        # adjunto seleccionable en las campañas.
        if ruta.name.lower() == "logo_cruzial.jpeg":
            continue

        adjuntos.append({
            "nombre": ruta.name,
            "size_bytes": ruta.stat().st_size,
        })

    return adjuntos


async def enviar_prueba_campana(
    email_destino: str = Form(...),
    nombre: str = Form("Prueba de campaña"),
    remitente: str = Form(...),
    asunto: str = Form(...),
    cuerpo_html: str = Form(...),
    adjuntos_genericos: str = Form("[]"),
    adjuntos_upload: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
):
    """
    Envía un email de prueba sin crear una campaña.
    Soporta adjuntos genéricos y adjuntos subidos desde el navegador.
    """
    email_destino = (email_destino or "").strip().lower()

    if not email_valido(email_destino):
        raise HTTPException(status_code=400, detail="Email de prueba inválido.")

    if not limpiar_texto(remitente):
        raise HTTPException(status_code=400, detail="El remitente es obligatorio.")

    if not limpiar_texto(asunto):
        raise HTTPException(status_code=400, detail="El asunto es obligatorio.")

    if not limpiar_texto(cuerpo_html):
        raise HTTPException(status_code=400, detail="El cuerpo del mensaje es obligatorio.")

    organization_id = current_organization_id(db)
    smtp_settings = organizacion_smtp_service.get_send_settings(db, organization_id)

    nombres_genericos = parsear_lista_json(adjuntos_genericos)
    rutas_adjuntos = resolver_adjuntos_genericos(
        nombres_genericos,
        fallar_si_no_existe=True,
    )

    cliente_prueba = cliente_prueba_para(email_destino)
    asunto_renderizado = renderizar_plantilla(asunto, cliente_prueba)
    cuerpo_renderizado = renderizar_plantilla(cuerpo_html, cliente_prueba)

    with tempfile.TemporaryDirectory() as tmpdir:
        rutas_adjuntos.extend(
            guardar_uploads_temporales(
                adjuntos_upload,
                Path(tmpdir),
            )
        )

        exito, detalle = mailer.enviar_correo(
            destinatario=email_destino,
            asunto=f"[PRUEBA] {asunto_renderizado}",
            cuerpo_html_base=cuerpo_renderizado,
            nombre_remitente=remitente or smtp_settings.from_name or "Grupo Publicitario Cruzial",
            rutas_adjuntos=rutas_adjuntos,
            smtp_config=smtp_settings,
        )

    if not exito:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo enviar el correo de prueba: {detalle}",
        )

    return {
        "mensaje": f"Correo de prueba enviado a {email_destino}.",
        "adjuntos": [ruta.name for ruta in rutas_adjuntos],
    }


async def crear_campana_desde_csv(
    background_tasks: BackgroundTasks,
    nombre: str = Form(...),
    remitente: str = Form(...),
    asunto: str = Form(...),
    cuerpo_html: str = Form(...),
    delay_segundos: int = Form(30),
    lanzar_inmediatamente: bool = Form(False),
    csv_file: UploadFile = File(...),
    adjuntos_genericos: str = Form("[]"),
    adjuntos_upload: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
):
    contenido = await csv_file.read()
    filas, errores_csv = parsear_csv_clientes(contenido)

    if not filas:
        raise HTTPException(
            status_code=400,
            detail={
                "mensaje": "No se encontraron destinatarios válidos en el CSV.",
                "errores": errores_csv[:30],
            },
        )

    emails_vistos = set()
    cliente_ids_vistos = set()
    destinatarios: List[models.Cliente] = []
    omitidos = 0

    organization_id = current_organization_id(db)
    user_id = current_user_id(db)

    if lanzar_inmediatamente:
        organizacion_smtp_service.get_send_settings(db, organization_id)

    try:
        plantilla = models.Plantilla(
            organization_id=organization_id,
            created_by_user_id=user_id,
            nombre_interno=nombre,
            asunto=asunto,
            cuerpo_html=cuerpo_html,
        )
        db.add(plantilla)
        db.flush()

        campana = models.Campana(
            organization_id=organization_id,
            created_by_user_id=user_id,
            nombre=nombre,
            estado="Preparada",
            plantilla_id=plantilla.id,
            remitente=remitente,
            delay_segundos=max(0, int(delay_segundos or 30)),
            total_destinatarios=0,
        )
        db.add(campana)
        db.flush()

        for fila in filas:
            cliente = obtener_o_crear_cliente_desde_csv(db, fila, organization_id=organization_id, user_id=user_id)

            if not cliente:
                omitidos += 1
                continue

            if cliente.id in cliente_ids_vistos:
                omitidos += 1
                continue

            if cliente.email and cliente.email.lower() in emails_vistos:
                omitidos += 1
                continue

            cliente_ids_vistos.add(cliente.id)
            if cliente.email:
                emails_vistos.add(cliente.email.lower())

            destinatarios.append(cliente)

            log = models.EnvioLog(
                organization_id=organization_id,
                campana_id=campana.id,
                cliente_id=cliente.id,
                estado="Pendiente",
            )
            db.add(log)

        if not destinatarios:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="No quedó ningún destinatario válido tras eliminar duplicados.",
            )

        adjuntos_guardados = guardar_adjuntos_campana(
            campana.id,
            adjuntos_genericos,
            adjuntos_upload,
            organization_id=organization_id,
        )

        campana.total_destinatarios = len(destinatarios)
        db.commit()
        db.refresh(campana)

        task_id = None

        if lanzar_inmediatamente:
            task_id = arrancar_task_campana(background_tasks, campana.id, organization_id=organization_id)

        return {
            "mensaje": "Campaña creada correctamente.",
            "campana_id": campana.id,
            "campana_public_id": campana.public_id,
            "task_id": task_id,
            "destinatarios": len(destinatarios),
            "omitidos": omitidos,
            "errores_csv": errores_csv[:30],
            "estado": campana.estado,
            "adjuntos": adjuntos_guardados,
        }

    except HTTPException:
        raise

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


def lanzar_campana_legacy(
    payload: schemas.CampanaLanzarRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Compatibilidad con la UI antigua: recibe IDs ya seleccionados y crea una campaña.
    """
    if not payload.cliente_ids:
        raise HTTPException(status_code=400, detail="No hay destinatarios seleccionados.")

    organization_id = current_organization_id(db)
    user_id = current_user_id(db)
    clientes = (
        db.query(models.Cliente)
        .filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.id.in_(payload.cliente_ids),
        )
        .all()
    )

    clientes_validos = [c for c in clientes if c.email]

    if not clientes_validos:
        raise HTTPException(status_code=400, detail="Ningún cliente seleccionado tiene email.")

    plantilla = models.Plantilla(
        organization_id=organization_id,
        created_by_user_id=user_id,
        nombre_interno=payload.nombre or payload.asunto,
        asunto=payload.asunto,
        cuerpo_html=payload.cuerpo,
    )
    db.add(plantilla)
    db.flush()

    campana = models.Campana(
        organization_id=organization_id,
        created_by_user_id=user_id,
        nombre=payload.nombre or payload.asunto,
        estado="Preparada",
        plantilla_id=plantilla.id,
        remitente=payload.remitente,
        delay_segundos=max(0, int(payload.delay_segundos or 30)),
        total_destinatarios=len(clientes_validos),
    )
    db.add(campana)
    db.flush()

    vistos = set()
    for cliente in clientes_validos:
        if cliente.email.lower() in vistos:
            continue
        vistos.add(cliente.email.lower())

        db.add(models.EnvioLog(
            organization_id=organization_id,
            campana_id=campana.id,
            cliente_id=cliente.id,
            estado="Pendiente",
        ))

    db.commit()
    db.refresh(campana)

    organizacion_smtp_service.get_send_settings(db, organization_id)
    task_id = arrancar_task_campana(background_tasks, campana.id, organization_id=organization_id)

    return {
        "task_id": task_id,
        "campana_id": campana.id,
        "campana_public_id": campana.public_id,
        "mensaje": "Campaña iniciada en segundo plano.",
    }


def lanzar_campana_existente(
    campana_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    organization_id = current_organization_id(db)
    campana = db.query(models.Campana).filter(
        models.Campana.organization_id == organization_id,
        models.Campana.id == campana_id,
    ).first()

    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada.")

    if campana.estado == "En Progreso":
        raise HTTPException(status_code=400, detail="La campaña ya está en progreso.")

    pendientes = (
        db.query(models.EnvioLog)
        .filter(
            models.EnvioLog.organization_id == organization_id,
            models.EnvioLog.campana_id == campana_id,
            models.EnvioLog.estado.in_(["Pendiente", "Enviando"]),
        )
        .count()
    )

    if pendientes == 0:
        raise HTTPException(status_code=400, detail="La campaña no tiene envíos pendientes.")

    # Si quedó algo en 'Enviando' por un corte, lo devolvemos a Pendiente.
    (
        db.query(models.EnvioLog)
        .filter(
            models.EnvioLog.organization_id == organization_id,
            models.EnvioLog.campana_id == campana_id,
            models.EnvioLog.estado == "Enviando",
        )
        .update({models.EnvioLog.estado: "Pendiente"})
    )
    campana.estado = "Preparada"
    db.commit()

    organizacion_smtp_service.get_send_settings(db, organization_id)
    task_id = arrancar_task_campana(background_tasks, campana_id, organization_id=organization_id)

    return {
        "task_id": task_id,
        "campana_id": campana_id,
        "campana_public_id": campana.public_id,
        "mensaje": "Campaña lanzada.",
    }


def detener_campana(campana_id: int, db: Session = Depends(get_db)):
    organization_id = current_organization_id(db)
    campana = db.query(models.Campana).filter(
        models.Campana.organization_id == organization_id,
        models.Campana.id == campana_id,
    ).first()

    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada.")

    encontrada = False
    for estado in ESTADO_ENVIOS.values():
        if estado.get("campana_id") == campana_id and not estado.get("finalizado"):
            estado["detener"] = True
            estado["mensaje"] = "Deteniendo campaña..."
            encontrada = True

    # Marcar en BD para que la UI lo refleje rápido.
    if campana.estado == "En Progreso":
        campana.estado = "Pausada"

        (
            db.query(models.EnvioLog)
            .filter(
                models.EnvioLog.campana_id == campana_id,
                models.EnvioLog.estado == "Enviando",
            )
            .update({models.EnvioLog.estado: "Pendiente"})
        )

        db.commit()

    return {
        "mensaje": "Señal de pausa enviada." if encontrada else "Campaña marcada como pausada.",
        "campana_id": campana_id,
        "campana_public_id": campana.public_id,
    }


def reanudar_campana(
    campana_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    organization_id = current_organization_id(db)
    campana = db.query(models.Campana).filter(
        models.Campana.organization_id == organization_id,
        models.Campana.id == campana_id,
    ).first()

    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada.")

    pendientes = (
        db.query(models.EnvioLog)
        .filter(
            models.EnvioLog.organization_id == organization_id,
            models.EnvioLog.campana_id == campana_id,
            models.EnvioLog.estado.in_(["Pendiente", "Enviando"]),
        )
        .count()
    )

    if pendientes == 0:
        raise HTTPException(status_code=400, detail="No quedan envíos pendientes.")

    (
        db.query(models.EnvioLog)
        .filter(
            models.EnvioLog.organization_id == organization_id,
            models.EnvioLog.campana_id == campana_id,
            models.EnvioLog.estado == "Enviando",
        )
        .update({models.EnvioLog.estado: "Pendiente"})
    )

    campana.estado = "Preparada"
    db.commit()

    organizacion_smtp_service.get_send_settings(db, organization_id)
    task_id = arrancar_task_campana(background_tasks, campana_id, organization_id=organization_id)

    return {
        "task_id": task_id,
        "campana_id": campana_id,
        "campana_public_id": campana.public_id,
        "mensaje": "Campaña reanudada.",
    }

def obtener_campana(
    campana_id: int,
    db: Session = Depends(get_db),
):
    organization_id = current_organization_id(db)
    campana = (
        db.query(models.Campana)
        .filter(
            models.Campana.organization_id == organization_id,
            models.Campana.id == campana_id,
        )
        .first()
    )

    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada.")

    resumen = resumen_campana_db(db, campana_id, organization_id=organization_id)

    plantilla = campana.plantilla

    return {
        **resumen,
        "id": campana.id,
        "campana_id": campana.id,
        "id": campana.id,
        "public_id": campana.public_id,
        "campana_public_id": campana.public_id,
        "nombre": campana.nombre,
        "estado": campana.estado,
        "remitente": campana.remitente,
        "delay_segundos": campana.delay_segundos,
        "plantilla_id": campana.plantilla_id,
        "asunto": plantilla.asunto if plantilla else "",
        "cuerpo_html": plantilla.cuerpo_html if plantilla else "",
        "plantilla": {
            "id": plantilla.id if plantilla else None,
            "public_id": plantilla.public_id if plantilla else None,
            "nombre_interno": plantilla.nombre_interno if plantilla else None,
            "asunto": plantilla.asunto if plantilla else "",
            "cuerpo_html": plantilla.cuerpo_html if plantilla else "",
            "fecha_creacion": (
                plantilla.fecha_creacion.isoformat()
                if plantilla and plantilla.fecha_creacion
                else None
            ),
        } if plantilla else None,
        "fecha_creacion": (
            campana.fecha_creacion.isoformat()
            if campana.fecha_creacion
            else None
        ),
        "fecha_inicio": (
            campana.fecha_inicio.isoformat()
            if campana.fecha_inicio
            else None
        ),
        "fecha_fin": (
            campana.fecha_fin.isoformat()
            if campana.fecha_fin
            else None
        ),
    }

def actualizar_campana(
    campana_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    organization_id = current_organization_id(db)
    campana = (
        db.query(models.Campana)
        .filter(
            models.Campana.organization_id == organization_id,
            models.Campana.id == campana_id,
        )
        .first()
    )

    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada.")

    if campana.estado == "En Progreso":
        raise HTTPException(
            status_code=400,
            detail="No puedes editar una campaña mientras está en progreso.",
        )

    nombre = limpiar_texto(payload.get("nombre"))
    remitente = limpiar_texto(payload.get("remitente"))
    asunto = limpiar_texto(payload.get("asunto"))
    cuerpo_html = limpiar_texto(payload.get("cuerpo_html"))
    delay_segundos = payload.get("delay_segundos")

    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre de la campaña es obligatorio.")

    if not remitente:
        raise HTTPException(status_code=400, detail="El remitente es obligatorio.")

    if not asunto:
        raise HTTPException(status_code=400, detail="El asunto es obligatorio.")

    if not cuerpo_html:
        raise HTTPException(status_code=400, detail="El cuerpo del mensaje es obligatorio.")

    try:
        delay_segundos = int(delay_segundos if delay_segundos is not None else 30)
    except Exception:
        delay_segundos = 30

    delay_segundos = max(0, min(delay_segundos, 600))

    try:
        campana.nombre = nombre
        campana.remitente = remitente
        campana.delay_segundos = delay_segundos

        if campana.plantilla:
            plantilla = campana.plantilla
        else:
            plantilla = models.Plantilla(
                organization_id=organization_id,
                created_by_user_id=current_user_id(db),
                nombre_interno=nombre,
                asunto=asunto,
                cuerpo_html=cuerpo_html,
            )
            db.add(plantilla)
            db.flush()
            campana.plantilla_id = plantilla.id

        plantilla.nombre_interno = nombre
        plantilla.asunto = asunto
        plantilla.cuerpo_html = cuerpo_html

        # Si una campaña ya completada se edita, la dejamos preparada solo si aún quedan pendientes.
        pendientes = (
            db.query(models.EnvioLog)
            .filter(
                models.EnvioLog.organization_id == organization_id,
                models.EnvioLog.campana_id == campana_id,
                models.EnvioLog.estado.in_(["Pendiente", "Enviando"]),
            )
            .count()
        )

        if campana.estado in ["Borrador", "Preparada", "Pausada"]:
            campana.estado = "Preparada"

        if campana.estado == "Completada" and pendientes > 0:
            campana.estado = "Preparada"
            campana.fecha_fin = None

        db.commit()
        db.refresh(campana)

        return {
            "mensaje": "Campaña actualizada correctamente.",
            "campana_id": campana.id,
            "campana_public_id": campana.public_id,
            "id": campana.id,
            "public_id": campana.public_id,
            "nombre": campana.nombre,
            "estado": campana.estado,
            "remitente": campana.remitente,
            "delay_segundos": campana.delay_segundos,
            "plantilla_id": campana.plantilla_id,
            "plantilla_public_id": campana.plantilla.public_id if campana.plantilla else None,
            "asunto": campana.plantilla.asunto if campana.plantilla else "",
            "cuerpo_html": campana.plantilla.cuerpo_html if campana.plantilla else "",
        }

    except HTTPException:
        raise

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo actualizar la campaña: {str(e)}",
        )

def consultar_estado_campana(campana_id: int, db: Session = Depends(get_db)):
    organization_id = current_organization_id(db)
    resumen = resumen_campana_db(db, campana_id, organization_id=organization_id)

    task_estado = None
    for estado in ESTADO_ENVIOS.values():
        if estado.get("campana_id") == campana_id and int(estado.get("organization_id") or 1) == organization_id:
            task_estado = estado
            break

    if task_estado:
        resumen["task_id"] = task_estado.get("task_id")
        resumen["mensaje"] = task_estado.get("mensaje")
        resumen["log_actividad"] = task_estado.get("log_actividad", [])[:200]
        resumen["detener"] = task_estado.get("detener", False)
    else:
        resumen["task_id"] = None
        resumen["mensaje"] = resumen["estado"]
        resumen["log_actividad"] = []

    return resumen


def consultar_estado_envio_legacy(task_id: str):
    return ESTADO_ENVIOS.get(task_id, {"error": "ID de campaña no encontrado"})


def consultar_logs_campana(
    campana_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    logs = (
        db.query(models.EnvioLog)
        .filter(
            models.EnvioLog.organization_id == current_organization_id(db),
            models.EnvioLog.campana_id == campana_id,
        )
        .order_by(models.EnvioLog.id.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": log.id,
            "cliente_id": log.cliente_id,
            "cliente_public_id": log.cliente.public_id if log.cliente else None,
            "email": log.cliente.email if log.cliente else None,
            "nombre": log.cliente.nombre if log.cliente else None,
            "estado": log.estado,
            "fecha_envio": log.fecha_envio.isoformat() if log.fecha_envio else None,
            "detalle_error": log.detalle_error,
            "intentos": log.intentos,
        }
        for log in logs
    ]


def _tabla_tiene_columnas(db: Session, tabla: str, columnas: set[str]) -> bool:
    """Comprueba tablas legacy sin asumir que existen en una BBDD nueva."""
    inspector = inspect(db.get_bind())
    if not inspector.has_table(tabla):
        return False
    existentes = {col["name"] for col in inspector.get_columns(tabla)}
    return columnas.issubset(existentes)


def eliminar_campana(campana_id: int, db: Session = Depends(get_db)):
    organization_id = current_organization_id(db)
    campana = db.query(models.Campana).filter(
        models.Campana.organization_id == organization_id,
        models.Campana.id == campana_id,
    ).first()

    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada.")

    if campana.estado == "En Progreso":
        raise HTTPException(status_code=400, detail="No puedes borrar una campaña en progreso.")

    nombre = campana.nombre

    try:
        # La BBDD histórica conserva ia_propuestas aunque la IA ya no forme parte
        # de Cruzial Local. Esa tabla tiene una FK NO ACTION hacia campanas, así
        # que anulamos solo la referencia para conservar el registro histórico.
        if _tabla_tiene_columnas(db, "ia_propuestas", {"created_campaign_id"}):
            db.execute(
                text(
                    "UPDATE ia_propuestas "
                    "SET created_campaign_id = NULL "
                    "WHERE created_campaign_id = :campana_id"
                ),
                {"campana_id": campana_id},
            )

        # Los envíos sí pertenecen a la campaña. La tabla histórica tampoco tiene
        # ON DELETE CASCADE, por lo que se eliminan de forma explícita.
        db.query(models.EnvioLog).filter(
            models.EnvioLog.organization_id == organization_id,
            models.EnvioLog.campana_id == campana_id,
        ).delete(synchronize_session=False)

        db.delete(campana)
        db.commit()
    except Exception:
        db.rollback()
        import logging
        logging.getLogger("cruzial").exception(
            "Error eliminando campaña id=%s organization_id=%s",
            campana_id,
            organization_id,
        )
        raise HTTPException(
            status_code=500,
            detail="No se pudo eliminar la campaña. Revisa logs/cruzial.log.",
        )

    # Los adjuntos en disco no tienen integridad referencial; se limpian después
    # de confirmar la transacción para no dejar la BBDD a medias si falla SQLite.
    try:
        shutil.rmtree(
            carpeta_adjuntos_campana(campana_id, organization_id=organization_id),
            ignore_errors=True,
        )
    except Exception:
        pass

    return {"mensaje": f"Campaña '{nombre}' eliminada correctamente."}

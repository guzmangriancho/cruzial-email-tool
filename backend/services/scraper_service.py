import re
import time
import uuid
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.dependencies import get_db
from backend import models, scraper
from backend.utils.tenant import current_organization_id, current_user_id, set_tenant_fields
from backend.utils.scraper_utils import generar_tareas_scraping



# Estado en memoria para la UI.
# Nota: si ejecutas FastAPI con varios workers, cada worker tendrá su propio ESTADO_TAREAS.
ESTADO_TAREAS: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------



# ---------------------------------------------------------------------------
# Helpers de estado/UI
# ---------------------------------------------------------------------------

def crear_estado_inicial(task_id: str, palabras_clave: str, ubicaciones: str, organization_id: int | None = None, user_id: int | None = None) -> None:
    ESTADO_TAREAS[task_id] = {
        "organization_id": organization_id or 1,
        "created_by_user_id": user_id,
        "estado": "Iniciando",
        "busqueda": "Iniciando workers...",
        "mensaje": "Asignando recursos...",
        "nuevos_clientes": 0,
        "clientes_actualizados": 0,
        "coordenadas_actuales": None,
        "detener": False,
        "log_actividad": [],
        "clientes_extraidos": [],
        "palabras_clave": palabras_clave,
        "ubicaciones": ubicaciones,
    }


def log_task(task_id: str, mensaje: str) -> None:
    if task_id not in ESTADO_TAREAS:
        return

    hora = time.strftime("%H:%M:%S")
    ESTADO_TAREAS[task_id].setdefault("log_actividad", [])
    ESTADO_TAREAS[task_id]["log_actividad"].insert(0, f"[{hora}] {mensaje}")
    ESTADO_TAREAS[task_id]["log_actividad"] = ESTADO_TAREAS[task_id]["log_actividad"][:150]


def set_estado(task_id: str, **kwargs) -> None:
    if task_id in ESTADO_TAREAS:
        ESTADO_TAREAS[task_id].update(kwargs)


def valor_ui(valor: Any, fallback: str = "N/D") -> Any:
    if valor is None or valor == "":
        return fallback
    return valor


def buscar_fila_ui(task_id: str, url_maps: str) -> Optional[Dict[str, Any]]:
    for fila in ESTADO_TAREAS.get(task_id, {}).get("clientes_extraidos", []):
        if fila.get("id_temp") == url_maps:
            return fila
    return None

def eliminar_fila_ui(task_id: str, url_maps: Optional[str]) -> None:
    if not url_maps:
        return

    estado = ESTADO_TAREAS.get(task_id)

    if not estado:
        return

    estado["clientes_extraidos"] = [
        fila
        for fila in estado.get("clientes_extraidos", [])
        if fila.get("id_temp") != url_maps and fila.get("url_maps") != url_maps
    ]


def actualizar_o_crear_fila_ui(task_id: str, res: Dict[str, Any], sector_actual: str) -> Dict[str, Any]:
    url_maps = res.get("url_maps")
    fila = buscar_fila_ui(task_id, url_maps) if url_maps else None

    if not fila:
        fila = {
            "id_temp": url_maps or str(uuid.uuid4()),
            "nombre": res.get("nombre") or "Sin nombre",
            "ciudad": "Buscando...",
            "email": "Pendiente...",
            "telefono": "...",
            "sector": sector_actual,
            "estado_fila": "cargando",
            "latitud": res.get("latitud"),
            "longitud": res.get("longitud"),
            "url_maps": url_maps,
        }
        ESTADO_TAREAS[task_id]["clientes_extraidos"].append(fila)

    return fila


# ---------------------------------------------------------------------------
# Helpers de persistencia
# ---------------------------------------------------------------------------

def email_valido(email: Optional[str]) -> bool:
    if not email:
        return False

    return bool(re.fullmatch(
        r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        email.strip(),
    ))


def datos_cliente_desde_resultado(
    res: Dict[str, Any],
    busqueda_actual: str,
    sector_actual: str,
) -> Dict[str, Any]:
    email = (res.get("email") or "").strip().lower()

    if not email_valido(email):
        email = None

    return {
        "nombre": res.get("nombre"),
        "email": email,
        "telefono": res.get("telefono"),
        "sitio_web": res.get("sitio_web"),
        "direccion": res.get("direccion"),
        "ciudad": res.get("ciudad"),
        "latitud": res.get("latitud"),
        "longitud": res.get("longitud"),
        "url_maps": res.get("url_maps"),
        "valoracion": res.get("valoracion"),
        "num_resenas": res.get("num_resenas"),
        "categoria_google": sector_actual,
        "termino_busqueda": res.get("termino_busqueda") or busqueda_actual,
        "sector": sector_actual,
        "prioridad": 3,
    }

def aplicar_datos_a_cliente(cliente: models.Cliente, datos: Dict[str, Any]) -> None:
    """
    Actualiza campos sin pisar con None ni cadenas vacías.

    El email solo se añade si:
    - el nuevo email es válido
    - y el cliente todavía no tenía email
    """
    for campo, valor in datos.items():
        if campo == "email":
            if email_valido(valor) and not cliente.email:
                cliente.email = valor.strip().lower()
            continue

        if valor is not None and valor != "":
            setattr(cliente, campo, valor)

def buscar_cliente_existente(
    db: Session,
    datos: Dict[str, Any],
    organization_id: int | None = None,
) -> Optional[models.Cliente]:
    """
    Busca duplicados por orden de fiabilidad:
    1. email
    2. url_maps
    3. sitio_web

    Así también podemos actualizar registros que no tienen email.
    """
    organization_id = organization_id or current_organization_id(db)
    email = datos.get("email")

    if email_valido(email):
        existente = db.query(models.Cliente).filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.email == email
        ).first()

        if existente:
            return existente

    url_maps = datos.get("url_maps")

    if url_maps:
        existente = db.query(models.Cliente).filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.url_maps == url_maps
        ).first()

        if existente:
            return existente

    sitio_web = datos.get("sitio_web")

    if sitio_web:
        existente = db.query(models.Cliente).filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.sitio_web == sitio_web
        ).first()

        if existente:
            return existente

    return None

def guardar_o_actualizar_cliente(
    db: Session,
    res: Dict[str, Any],
    busqueda_actual: str,
    sector_actual: str,
    organization_id: int | None = None,
    user_id: int | None = None,
) -> Tuple[str, Optional[models.Cliente]]:
    """
    Guarda siempre que haya algún dato útil, aunque no haya email.

    Devuelve:
    - "creado"
    - "actualizado"
    - "omitido"
    """
    organization_id = organization_id or current_organization_id(db)
    user_id = user_id if user_id is not None else current_user_id(db)
    datos = datos_cliente_desde_resultado(res, busqueda_actual, sector_actual)

    if not datos.get("nombre") and not datos.get("url_maps") and not datos.get("sitio_web"):
        return "omitido", None

    existente = buscar_cliente_existente(db, datos, organization_id=organization_id)

    if existente:
        aplicar_datos_a_cliente(existente, datos)
        db.commit()
        db.refresh(existente)
        return "actualizado", existente

    nuevo = models.Cliente(**datos)
    nuevo.organization_id = organization_id
    nuevo.created_by_user_id = user_id

    try:
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
        return "creado", nuevo

    except IntegrityError:
        db.rollback()

        existente = buscar_cliente_existente(db, datos, organization_id=organization_id)

        if existente:
            aplicar_datos_a_cliente(existente, datos)
            db.commit()
            db.refresh(existente)
            return "actualizado", existente

        return "omitido", None


# ---------------------------------------------------------------------------
# Background scraping
# ---------------------------------------------------------------------------

def tarea_scraping_segundo_plano(
    task_id: str,
    palabras_clave: str,
    ubicaciones: str,
    modo_prueba: bool,
    organization_id: int | None = None,
    user_id: int | None = None,
) -> None:
    """
    Tarea de scraping.

    Importante:
    Abrimos SessionLocal() dentro de la tarea. No reutilizamos una sesión de FastAPI
    recibida por Depends(), porque esa sesión se cierra al terminar la respuesta HTTP.
    """
    db = SessionLocal()
    organization_id = organization_id or ESTADO_TAREAS.get(task_id, {}).get("organization_id") or 1
    user_id = user_id if user_id is not None else ESTADO_TAREAS.get(task_id, {}).get("created_by_user_id")
    db.info["organization_id"] = organization_id
    db.info["user_id"] = user_id

    urls_maps_omitidas = {
        row[0]
        for row in db.query(models.Cliente.url_maps)
        .filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.url_maps.isnot(None),
            models.Cliente.url_maps != "",
        )
        .all()
    }

    def email_ya_existe_en_bd(email: str) -> bool:
        email_limpio = (email or "").strip().lower()

        if not email_valido(email_limpio):
            return False

        return db.query(models.Cliente.id).filter(
            models.Cliente.organization_id == organization_id,
            models.Cliente.email == email_limpio
        ).first() is not None

    palabras = [p.strip() for p in palabras_clave.split(",") if p.strip()]
    lugares = [u.strip() for u in ubicaciones.split(",") if u.strip()]

    tareas = generar_tareas_scraping(
        palabras,
        lugares,
        modo_prueba=modo_prueba,
        estrategia_ayuntamientos="zonas",
        # Para sectores normales la utilidad limita internamente a pocas búsquedas.
        # Para ayuntamientos permite más cobertura por provincia.
        max_busquedas_por_lugar=60,
    )

    total_combinaciones = len(tareas)
    total_guardados = 0
    total_actualizados = 0

    try:
        set_estado(
            task_id,
            estado="Ejecutando",
            busqueda=f"Matriz: {len(palabras)} sectores x {len(lugares)} ubicaciones → {len(tareas)} búsquedas reales",
            mensaje="Iniciando motor...",
            nuevos_clientes=0,
            clientes_actualizados=0,
            coordenadas_actuales=None,
            detener=False,
        )

        if not tareas:
            set_estado(
                task_id,
                estado="Error",
                mensaje="No hay palabras clave o ubicaciones válidas.",
            )
            return

        for indice, tarea in enumerate(tareas, 1):
            if ESTADO_TAREAS[task_id].get("detener"):
                break

            busqueda_actual = tarea["busqueda"]
            sector_actual = tarea["sector_automatico"]

            set_estado(
                task_id,
                mensaje=f"Paso {indice}/{total_combinaciones}: Procesando '{busqueda_actual}'",
            )
            log_task(task_id, f"=== INICIANDO: {busqueda_actual} ===")

            generador = scraper.ejecutar_busqueda(
                busqueda_actual,
                sector_actual,
                modo_prueba=modo_prueba,
                logger=lambda msg: log_task(task_id, msg),
                urls_maps_omitidas=urls_maps_omitidas,
                email_ya_existe=email_ya_existe_en_bd,
            )

            for res in generador:
                if ESTADO_TAREAS[task_id].get("detener"):
                    break

                fase = res.get("fase")
                url_maps = res.get("url_maps")

                if fase in ["duplicado_url_maps", "duplicado_email"]:
                    eliminar_fila_ui(task_id, url_maps)

                    if fase == "duplicado_url_maps":
                        log_task(
                            task_id,
                            f"  ↳ Ya existe en BD. Ocultado de la tabla: {res.get('nombre')}"
                        )

                    elif fase == "duplicado_email":
                        log_task(
                            task_id,
                            f"  ↳ Email ya existente. Ocultado de la tabla: {res.get('email')}"
                        )

                    continue

                if fase == "moviendo_mapa":
                    if res.get("latitud") is not None and res.get("longitud") is not None:
                        set_estado(
                            task_id,
                            coordenadas_actuales=[res["latitud"], res["longitud"]],
                        )
                    continue

                # FASE 1: fila visual.
                if fase == 1:
                    fila = actualizar_o_crear_fila_ui(task_id, res, sector_actual)

                    fila.update({
                        "nombre": res.get("nombre") or fila.get("nombre"),
                        "ciudad": "Buscando...",
                        "email": "Pendiente...",
                        "telefono": "...",
                        "sector": sector_actual,
                        "categoria_google": sector_actual,
                        "estado_fila": "cargando",
                        "latitud": res.get("latitud"),
                        "longitud": res.get("longitud"),
                        "url_maps": url_maps,
                    })

                    if res.get("latitud") is not None and res.get("longitud") is not None:
                        set_estado(
                            task_id,
                            coordenadas_actuales=[res["latitud"], res["longitud"]],
                        )

                        continue


                    if fase in ["duplicado_url_maps", "duplicado_email"]:
                        fila = actualizar_o_crear_fila_ui(task_id, res, sector_actual)

                        fila.update({
                            "nombre": res.get("nombre") or fila.get("nombre"),
                            "ciudad": valor_ui(res.get("ciudad")),
                            "email": valor_ui(res.get("email"), "Ya existe"),
                            "telefono": valor_ui(res.get("telefono")),
                            "sitio_web": res.get("sitio_web"),
                            "direccion": res.get("direccion"),
                            "latitud": res.get("latitud"),
                            "longitud": res.get("longitud"),
                            "url_maps": url_maps,
                            "valoracion": res.get("valoracion"),
                            "num_resenas": res.get("num_resenas"),
                            "categoria_google": sector_actual,
                            "sector": sector_actual,
                            "estado_fila": "duplicado",
                        })

                        if fase == "duplicado_url_maps":
                            log_task(task_id, f"  ↳ Ya existe en BD por URL de Maps: {res.get('nombre')}")

                        if fase == "duplicado_email":
                            log_task(task_id, f"  ↳ Ya existe en BD por email: {res.get('email')}")

                        continue

                # FASE 2: éxito + guardar en BD.
                if fase == 2:
                    fila = actualizar_o_crear_fila_ui(task_id, res, sector_actual)

                    fila.update({
                        "nombre": res.get("nombre") or fila.get("nombre"),
                        "ciudad": valor_ui(res.get("ciudad")),
                        "email": valor_ui(res.get("email"), "Sin email"),
                        "telefono": valor_ui(res.get("telefono")),
                        "sitio_web": res.get("sitio_web"),
                        "direccion": res.get("direccion"),
                        "latitud": res.get("latitud"),
                        "longitud": res.get("longitud"),
                        "url_maps": url_maps,
                        "valoracion": res.get("valoracion"),
                        "num_resenas": res.get("num_resenas"),
                        "categoria_google": sector_actual,
                        "sector": sector_actual,
                        "estado_fila": "completado",
                    })

                    estado_guardado, _cliente = guardar_o_actualizar_cliente(
                        db,
                        res,
                        busqueda_actual,
                        sector_actual,
                        organization_id=organization_id,
                        user_id=user_id,
                    )

                    if url_maps:
                        urls_maps_omitidas.add(url_maps)

                    if estado_guardado == "creado":
                        total_guardados += 1
                        set_estado(task_id, nuevos_clientes=total_guardados)
                        log_task(task_id, f"  ↳ Guardado en BD: {res.get('email')}")

                    elif estado_guardado == "actualizado":
                        total_actualizados += 1
                        set_estado(task_id, clientes_actualizados=total_actualizados)
                        log_task(task_id, f"  ↳ Ya existía. Actualizado: {res.get('email')}")

                    else:
                        log_task(task_id, f"  ↳ Omitido en BD: email inválido o vacío")

                    continue

                # DESCARTADO/ERROR: actualizar fila visual.
                if fase in ["descartado", "error"]:
                    fila = buscar_fila_ui(task_id, url_maps) if url_maps else None

                    if fila:
                        fila.update({
                            "email": "Sin datos de contacto",
                            "estado_fila": "descartado" if fase == "descartado" else "error",
                        })

                    continue

        if ESTADO_TAREAS[task_id].get("detener"):
            set_estado(
                task_id,
                estado="Detenido",
                mensaje="Abortado. Se conservan los extraídos.",
            )
            log_task(task_id, "⏹️ Búsqueda detenida por el usuario.")
        else:
            set_estado(
                task_id,
                estado="Completado",
                mensaje="Extracción finalizada correctamente.",
            )
            log_task(task_id, "🏁 Búsqueda 100% completada.")

    except Exception as e:
        set_estado(
            task_id,
            estado="Error",
            mensaje=f"Excepción fatal: {str(e)}",
        )
        log_task(task_id, f"❌ Error fatal: {str(e)}")

    finally:
        db.close()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def iniciar_busqueda(
    palabras_clave: str,
    ubicaciones: str,
    background_tasks: BackgroundTasks,
    modo_prueba: bool = False,
    db: Session = Depends(get_db),
):
    task_id = str(uuid.uuid4())
    organization_id = current_organization_id(db)
    user_id = current_user_id(db)

    crear_estado_inicial(task_id, palabras_clave, ubicaciones, organization_id=organization_id, user_id=user_id)

    background_tasks.add_task(
        tarea_scraping_segundo_plano,
        task_id,
        palabras_clave,
        ubicaciones,
        modo_prueba,
        organization_id,
        user_id,
    )

    return {
        "mensaje": "Tarea encolada",
        "task_id": task_id,
    }


def consultar_estado(task_id: str, db: Session = Depends(get_db)):
    estado = ESTADO_TAREAS.get(task_id)

    if not estado:
        return {
            "estado": "No encontrado",
            "mensaje": "Referencia de tarea inválida.",
        }

    if int(estado.get("organization_id") or 1) != current_organization_id(db):
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    return estado


def detener_busqueda(task_id: str, db: Session = Depends(get_db)):
    estado = ESTADO_TAREAS.get(task_id)

    if not estado:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if int(estado.get("organization_id") or 1) != current_organization_id(db):
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if estado.get("estado") == "Ejecutando":
        estado["detener"] = True
        return {"mensaje": "Señal de interrupción enviada."}

    return {"mensaje": "La tarea no está en ejecución."}


# ---------------------------------------------------------------------------
# Enriquecimiento manual de un cliente existente
# ---------------------------------------------------------------------------

def extraer_coords_maps_url(url: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Google Maps puede exponer coordenadas de varias formas:
    - @43.46,-3.80,17z
    - !3d43.46!4d-3.80
    """
    if not url:
        return None, None

    match_at = re.search(r"@([-]?\d+\.\d+),([-]?\d+\.\d+)", url)
    if match_at:
        return float(match_at.group(1)), float(match_at.group(2))

    match_bang = re.search(r"!3d([-]?\d+\.\d+)!4d([-]?\d+\.\d+)", url)
    if match_bang:
        return float(match_bang.group(1)), float(match_bang.group(2))

    return None, None


def abrir_ficha_maps_por_nombre(driver, termino: str) -> None:
    url_busqueda = f"https://www.google.es/maps/search/{termino.replace(' ', '+')}"
    driver.get(url_busqueda)
    time.sleep(4)

    try:
        scraper.aceptar_cookies_maps(driver)
    except Exception:
        pass

    # Si Google Maps ya abrió una ficha directamente, no hacemos nada.
    if "/place/" in driver.current_url:
        return

    try:
        enlaces = driver.find_elements("css selector", "a[href*='/maps/place/']")

        if not enlaces:
            return

        termino_l = termino.lower()
        tokens = [
            t
            for t in re.split(r"\s+", termino_l)
            if len(t) >= 4 and t not in {"ayuntamiento", "municipio", "cantabria"}
        ]

        mejor_enlace = enlaces[0]
        mejor_score = -1

        for enlace in enlaces:
            titulo = (
                enlace.get_attribute("aria-label")
                or enlace.text
                or ""
            ).lower()

            href = enlace.get_attribute("href") or ""

            score = 0

            for token in tokens:
                if token in titulo:
                    score += 10
                if token in href.lower():
                    score += 3

            if "ayuntamiento" in titulo and "ayuntamiento" in termino_l:
                score += 10

            if score > mejor_score:
                mejor_score = score
                mejor_enlace = enlace

        driver.execute_script("arguments[0].click();", mejor_enlace)
        time.sleep(4)

    except Exception:
        pass


# ---------------------------------------------------------------------------
# Enriquecimiento manual de un cliente existente
# ---------------------------------------------------------------------------

def es_url_google_maps(url: Optional[str]) -> bool:
    """
    Acepta URLs largas y cortas de Google Maps:
    - https://www.google.com/maps/...
    - https://maps.google.com/...
    - https://maps.app.goo.gl/...
    - https://goo.gl/maps/...
    """
    if not url:
        return False

    url_limpia = url.strip().lower()

    return (
        "google." in url_limpia and "/maps" in url_limpia
    ) or (
        "maps.app.goo.gl" in url_limpia
    ) or (
        "goo.gl/maps" in url_limpia
    )


def valor_util(valor: Any) -> Optional[str]:
    if valor is None:
        return None

    texto = str(valor).strip()

    if not texto:
        return None

    if texto.lower() in {"n/d", "sin sector", "sin categoría", "sin categoria", "none", "null"}:
        return None

    return texto


def extraer_coords_maps_url(url: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Google Maps puede exponer coordenadas de varias formas:
    - @43.46,-3.80,17z
    - !3d43.46!4d-3.80
    """
    if not url:
        return None, None

    match_at = re.search(r"@([-]?\d+(?:\.\d+)?),([-]?\d+(?:\.\d+)?)", url)
    if match_at:
        return float(match_at.group(1)), float(match_at.group(2))

    match_bang = re.search(r"!3d([-]?\d+(?:\.\d+)?)!4d([-]?\d+(?:\.\d+)?)", url)
    if match_bang:
        return float(match_bang.group(1)), float(match_bang.group(2))

    return None, None


def esperar_maps_cargado(driver, segundos: int = 8) -> None:
    """
    Espera ligera para que:
    - un enlace corto maps.app.goo.gl redirija
    - Google Maps cargue la ficha/panel lateral
    """
    inicio = time.time()

    while time.time() - inicio < segundos:
        try:
            ready_state = driver.execute_script("return document.readyState")
            url_actual = driver.current_url or ""

            if ready_state == "complete" and "maps.app.goo.gl" not in url_actual:
                time.sleep(1.5)
                return

        except Exception:
            pass

        time.sleep(0.5)


def abrir_ficha_maps_por_url(driver, url_maps: str) -> None:
    """
    Abre una URL de Maps directamente.

    También sirve para URLs cortas tipo:
    https://maps.app.goo.gl/xxxx
    """
    driver.get(url_maps)
    esperar_maps_cargado(driver, segundos=10)

    try:
        scraper.aceptar_cookies_maps(driver)
        time.sleep(1.5)
    except Exception:
        pass

    esperar_maps_cargado(driver, segundos=5)


def abrir_ficha_maps_por_nombre(driver, termino: str) -> None:
    url_busqueda = f"https://www.google.es/maps/search/{termino.replace(' ', '+')}"
    driver.get(url_busqueda)
    time.sleep(4)

    try:
        scraper.aceptar_cookies_maps(driver)
    except Exception:
        pass

    if "/place/" in driver.current_url:
        return

    try:
        enlaces = driver.find_elements("css selector", "a[href*='/maps/place/']")

        if not enlaces:
            return

        termino_l = termino.lower()
        tokens = [
            t
            for t in re.split(r"\s+", termino_l)
            if len(t) >= 4 and t not in {"ayuntamiento", "municipio", "cantabria"}
        ]

        mejor_enlace = enlaces[0]
        mejor_score = -1

        for enlace in enlaces:
            titulo = (
                enlace.get_attribute("aria-label")
                or enlace.text
                or ""
            ).lower()

            href = enlace.get_attribute("href") or ""

            score = 0

            for token in tokens:
                if token in titulo:
                    score += 10
                if token in href.lower():
                    score += 3

            if "ayuntamiento" in titulo and "ayuntamiento" in termino_l:
                score += 10

            if score > mejor_score:
                mejor_score = score
                mejor_enlace = enlace

        driver.execute_script("arguments[0].click();", mejor_enlace)
        time.sleep(4)

    except Exception:
        pass


def extraer_nombre_desde_url_maps(url: str) -> Optional[str]:
    """
    Fallback por si el h1 no carga pero la URL contiene /place/Nombre.
    """
    if not url:
        return None

    try:
        from urllib.parse import unquote

        match = re.search(r"/place/([^/@?]+)", url)

        if not match:
            return None

        nombre = unquote(match.group(1)).replace("+", " ").strip()
        return valor_util(nombre)

    except Exception:
        return None


def extraer_texto_primer_selector(driver, selectores: list[str]) -> Optional[str]:
    for selector in selectores:
        try:
            elementos = driver.find_elements("css selector", selector)

            for elemento in elementos:
                texto = valor_util(elemento.text)

                if texto:
                    return texto

                aria_label = valor_util(elemento.get_attribute("aria-label"))

                if aria_label:
                    return aria_label

        except Exception:
            continue

    return None


def limpiar_categoria_maps(texto: Optional[str]) -> Optional[str]:
    texto = valor_util(texto)

    if not texto:
        return None

    texto = texto.replace("Categoría:", "").replace("Categoria:", "")
    texto = texto.replace("Category:", "")
    texto = texto.strip()

    if "\n" in texto:
        texto = texto.split("\n")[0].strip()

    texto_l = texto.lower()

    palabras_invalidas = {
        "sitio web",
        "indicaciones",
        "guardar",
        "llamar",
        "compartir",
        "reseñas",
        "resenas",
        "fotos",
        "enviar",
        "abrir",
        "cerrar",
        "más",
        "mas",
    }

    if texto_l in palabras_invalidas:
        return None

    if len(texto) > 80:
        return None

    if re.fullmatch(r"[\d\s()+.-]+", texto):
        return None

    return texto


def extraer_nombre_categoria_visual_maps(driver) -> Tuple[Optional[str], Optional[str]]:
    """
    Extrae nombre y categoría directamente del panel visual de Google Maps.

    Esto es importante porque scraper.extraer_datos_ficha_maps() puede no devolver:
    - nombre
    - categoria_google
    """
    nombre = extraer_texto_primer_selector(
        driver,
        [
            "h1.DUwDvf",
            "h1[class*='DUwDvf']",
            "div[role='main'] h1",
            "h1",
        ],
    )

    categoria = None

    selectores_categoria = [
        "button[jsaction*='pane.rating.category']",
        "button.DkEaL",
        "button[class*='DkEaL']",
        "div.DkEaL",
        "span.DkEaL",
        "button[aria-label*='Categoría']",
        "button[aria-label*='Categoria']",
        "button[aria-label*='Category']",
    ]

    for selector in selectores_categoria:
        try:
            elementos = driver.find_elements("css selector", selector)

            for elemento in elementos:
                candidato = limpiar_categoria_maps(elemento.text)

                if not candidato:
                    candidato = limpiar_categoria_maps(
                        elemento.get_attribute("aria-label")
                    )

                if candidato:
                    categoria = candidato
                    break

            if categoria:
                break

        except Exception:
            continue

    return valor_util(nombre), categoria


def enriquecer_cliente(cliente_id: int, db: Session = Depends(get_db)):
    organization_id = current_organization_id(db)
    cliente = db.query(models.Cliente).filter(
        models.Cliente.organization_id == organization_id,
        models.Cliente.id == cliente_id,
    ).first()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    driver = scraper.crear_driver()

    try:
        termino = (cliente.nombre or "").strip()
        url_maps_cliente = (cliente.url_maps or "").strip()

        if url_maps_cliente:
            if not es_url_google_maps(url_maps_cliente):
                raise HTTPException(
                    status_code=400,
                    detail="La URL indicada no parece ser una ficha válida de Google Maps.",
                )

            abrir_ficha_maps_por_url(driver, url_maps_cliente)

        else:
            if not termino:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "El cliente no tiene nombre ni URL de Google Maps. "
                        "Añade una ficha de Maps o un nombre para poder enriquecerlo."
                    ),
                )

            partes_busqueda = [termino]

            if cliente.ciudad:
                partes_busqueda.append(cliente.ciudad)

            if cliente.sector:
                partes_busqueda.append(cliente.sector)
            elif cliente.categoria_google:
                partes_busqueda.append(cliente.categoria_google)

            termino_maps = " ".join(p for p in partes_busqueda if p).strip()

            abrir_ficha_maps_por_nombre(driver, termino_maps)

        url_actual = driver.current_url or ""

        if es_url_google_maps(url_actual):
            cliente.url_maps = url_actual

            latitud, longitud = extraer_coords_maps_url(url_actual)

            if latitud is not None and longitud is not None:
                cliente.latitud = latitud
                cliente.longitud = longitud

        nombre_visual, categoria_visual = extraer_nombre_categoria_visual_maps(driver)

        datos = scraper.extraer_datos_ficha_maps(
            driver,
            cliente.sector or cliente.categoria_google or categoria_visual or "Sin sector",
        )

        if datos is None:
            datos = {}

        nombre_extraido = (
            valor_util(datos.get("nombre"))
            or nombre_visual
            or extraer_nombre_desde_url_maps(url_actual)
        )

        categoria_extraida = (
            valor_util(datos.get("categoria_google"))
            or valor_util(datos.get("sector"))
            or categoria_visual
        )

        # Nombre: se rellena si estaba vacío o venía como placeholder.
        if nombre_extraido and (
            not cliente.nombre
            or cliente.nombre.strip().lower() in {"sin nombre", "nuevo cliente"}
        ):
            cliente.nombre = nombre_extraido

        # Sector / categoría:
        # Si Google Maps da categoría, la usamos para ambos campos cuando estén vacíos.
        if categoria_extraida:
            if not cliente.sector:
                cliente.sector = categoria_extraida

            if not cliente.categoria_google:
                cliente.categoria_google = categoria_extraida

        # Si uno de los dos ya existía, sincronizamos el otro.
        if cliente.sector and not cliente.categoria_google:
            cliente.categoria_google = cliente.sector

        if cliente.categoria_google and not cliente.sector:
            cliente.sector = cliente.categoria_google

        ciudad_extraida = datos.get("ciudad")

        if ciudad_extraida and scraper.parece_direccion_no_ciudad(ciudad_extraida):
            ciudad_extraida = None

        if datos.get("telefono"):
            cliente.telefono = datos["telefono"]

        if datos.get("direccion"):
            cliente.direccion = datos["direccion"]

        if ciudad_extraida:
            cliente.ciudad = ciudad_extraida

        if datos.get("sitio_web"):
            cliente.sitio_web = datos["sitio_web"]

        if datos.get("valoracion") is not None:
            cliente.valoracion = datos["valoracion"]

        if datos.get("num_resenas") is not None:
            cliente.num_resenas = datos["num_resenas"]

        if datos.get("latitud") is not None:
            cliente.latitud = datos["latitud"]

        if datos.get("longitud") is not None:
            cliente.longitud = datos["longitud"]

        if datos.get("url_maps"):
            cliente.url_maps = datos["url_maps"]

        if datos.get("sitio_web") and not cliente.email:
            try:
                email = scraper.buscar_correos_profundo(
                    datos["sitio_web"],
                    cliente.nombre or nombre_extraido or "",
                    sector=cliente.sector or cliente.categoria_google,
                    driver=driver,
                    logger=None,
                )

                if email and email_valido(email):
                    cliente.email = email.strip().lower()

            except Exception:
                pass

        set_tenant_fields(cliente, db, creating=False)
        db.commit()
        db.refresh(cliente)

        return cliente

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error en extracción: {str(e)}",
        )

    finally:
        try:
            driver.quit()
        except Exception:
            pass


def diagnostico_entorno_scraper():
    """Diagnóstico ligero del entorno Selenium/Chrome local."""
    return {
        "chrome_bin": scraper._detectar_chrome_bin(),
        "chromedriver_path": scraper._detectar_chromedriver(),
        "chrome_bin_env": scraper.os.getenv("CHROME_BIN"),
        "chromedriver_path_env": scraper.os.getenv("CHROMEDRIVER_PATH"),
        "recomendacion": (
            "Si chrome_bin aparece vacío, instala Google Chrome en este equipo o define "
            "CHROME_BIN/CHROMEDRIVER_PATH en .env si usas rutas no estándar. "
            "En macOS se detecta automáticamente Google Chrome dentro de /Applications."
        ),
    }

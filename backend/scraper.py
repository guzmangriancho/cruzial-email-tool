import os
import random
import re
import shutil
import time
from html import unescape
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import quote_plus, unquote, urljoin, urlparse, urldefrag

import requests
import urllib3
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.common.exceptions import (
    JavascriptException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# ---------------------------------------------------------------------------
# Configuración general
# ---------------------------------------------------------------------------

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

REQUEST_TIMEOUT = 7
MAX_ENLACES_REALES_EMAIL = 10
MAX_RUTAS_PROBABLES_EMAIL = 5
MAX_URLS_SELENIUM_EMAIL = 4

EMAIL_RE = re.compile(
    r"(?<![\w.-])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?![\w.-])"
)

MAILTO_RE = re.compile(
    r"mailto:\s*([^\"'<>\s]+)",
    re.IGNORECASE,
)

EXTENSIONES_BASURA = (
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".js", ".css", ".ico", ".pdf", ".mp4", ".webm",
)

PALABRAS_EMAIL_BUENO = [
    "info", "contacto", "contact", "hola", "hello", "general",
    "atencion", "atención", "cliente", "clientes", "ciudadano", "ciudadana",
    "buzon", "buzón", "oficina", "administracion", "administración",
    "secretaria", "secretaría", "recepcion", "recepción", "reservas",
    "reserva", "booking", "comercial", "ventas", "direccion", "dirección",
    "gerencia", "rrhh", "personal", "admisiones", "matricula", "matrícula",
    "citas", "oac", "registro", "ayto", "ayuntamiento", "alcaldia", "alcaldía",
]

PALABRAS_EMAIL_MALO = [
    "protecciondedatos", "protección.datos", "proteccion.datos", "datos",
    "dpo", "dpd", "lopd", "rgpd", "gdpr", "privacidad", "privacy",
    "cookies", "transparencia", "noreply", "no-reply", "donotreply",
    "notificaciones", "notification", "notifications", "newsletter", "robot",
    "sistemas", "informatica", "informática", "soporte", "support", "abuse",
    "postmaster", "hostmaster", "webmaster",
]

PALABRAS_EMAIL_FALLBACK = ["admin", "administrador", "portal", "web"]

PROVINCIAS_O_TERRITORIOS = {
    "alava", "álava", "araba", "albacete", "alicante", "alacant", "almeria", "almería",
    "asturias", "avila", "ávila", "badajoz", "barcelona", "burgos", "caceres", "cáceres",
    "cadiz", "cádiz", "cantabria", "castellon", "castellón", "ciudad real", "cordoba", "córdoba",
    "cuenca", "girona", "gerona", "granada", "guadalajara", "gipuzkoa", "guipuzcoa", "huelva",
    "huesca", "illes balears", "islas baleares", "jaen", "jaén", "la coruña", "a coruña",
    "la rioja", "las palmas", "leon", "león", "lleida", "lerida", "lérida", "lugo", "madrid",
    "malaga", "málaga", "murcia", "navarra", "ourense", "orense", "palencia", "pontevedra",
    "salamanca", "santa cruz de tenerife", "segovia", "sevilla", "soria", "tarragona", "teruel",
    "toledo", "valencia", "valladolid", "bizkaia", "vizcaya", "zamora", "zaragoza", "españa", "spain",
}

PALABRAS_DIRECCION = [
    "calle", "c/", "plaza", "avda", "avenida", "barrio", "carretera", "ctra",
    "camino", "paseo", "travesia", "travesía", "poligono", "polígono",
    "urbanizacion", "urbanización", "edificio", "portal", "nº", "num", "número", "numero", "km",
]


# ---------------------------------------------------------------------------
# Utilidades generales
# ---------------------------------------------------------------------------

def log_si(logger: Optional[Callable[[str], None]], msg: str) -> None:
    if logger:
        logger(msg)


def normalizar_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return url
    if not url.startswith(("http://", "https://")):
        return "https://" + url
    return url


def normalizar_email(valor: str) -> str:
    valor = unquote(unescape(valor or "")).strip()
    if valor.lower().startswith("mailto:"):
        valor = valor[7:]
    valor = valor.split("?")[0]
    valor = valor.split("&subject=")[0]
    valor = valor.split("&body=")[0]
    valor = valor.strip(" \t\r\n.,;:()[]<>\"'")
    return valor.lower()


def dominio_limpio(url: str) -> str:
    return urlparse(url or "").netloc.lower().replace("www.", "")


def es_url_interna(url_base: str, url: str) -> bool:
    base = dominio_limpio(url_base)
    dom = dominio_limpio(url)
    if not base or not dom:
        return True
    return dom == base or dom.endswith("." + base)


def limpiar_nombre_para_match(texto: str) -> str:
    texto = (texto or "").lower()
    for prefijo in [
        "ayuntamiento de ", "ayuntamiento", "gobierno de ", "colegio de ",
        "colegio ", "instituto de ", "instituto ", "restaurante ", "hotel ",
    ]:
        texto = texto.replace(prefijo, "")
    texto = texto.strip()
    return re.sub(r"[^a-záéíóúüñ0-9]+", "", texto)


def normalizar_texto_simple(texto: str) -> str:
    texto = (texto or "").lower().strip()
    texto = texto.replace(".", " ")
    return re.sub(r"\s+", " ", texto)


# ---------------------------------------------------------------------------
# Extracción y scoring de emails
# ---------------------------------------------------------------------------

def decodificar_cloudflare_cfemail(cfemail: str) -> Optional[str]:
    try:
        data = bytes.fromhex(cfemail)
        key = data[0]
        decoded = "".join(chr(b ^ key) for b in data[1:])
        if EMAIL_RE.fullmatch(decoded):
            return decoded.lower()
    except Exception:
        return None
    return None


def extraer_emails_obfuscados(texto: str) -> List[str]:
    if not texto:
        return []
    normalizado = unquote(unescape(texto))
    normalizado = re.sub(r"\s*(?:\[|\()?arroba(?:\]|\))?\s*", "@", normalizado, flags=re.I)
    normalizado = re.sub(r"\s*(?:\[|\()?punto(?:\]|\))?\s*", ".", normalizado, flags=re.I)
    return [normalizar_email(e) for e in EMAIL_RE.findall(normalizado)]


def extraer_emails_de_html(html: str) -> List[str]:
    html = unquote(unescape(html or ""))
    candidatos: List[str] = []

    for mailto in MAILTO_RE.findall(html):
        candidatos.append(normalizar_email(mailto))

    for email in EMAIL_RE.findall(html):
        candidatos.append(normalizar_email(email))

    for cfemail in re.findall(r'data-cfemail=["\']([a-fA-F0-9]+)["\']', html):
        decoded = decodificar_cloudflare_cfemail(cfemail)
        if decoded:
            candidatos.append(decoded)

    candidatos.extend(extraer_emails_obfuscados(html))
    return candidatos


def palabras_extra_por_sector(sector: Optional[str]) -> List[str]:
    sector_l = (sector or "").lower()
    extras: List[str] = []

    if any(x in sector_l for x in ["coleg", "escuela", "instituto", "academia", "universidad"]):
        extras.extend(["secretaria", "secretaría", "direccion", "dirección", "admisiones", "matricula", "matrícula"])
    if any(x in sector_l for x in ["restaurante", "bar", "cafeter", "hotel", "hostal", "alojamiento"]):
        extras.extend(["reservas", "reserva", "booking", "recepcion", "recepción"])
    if any(x in sector_l for x in ["clinica", "clínica", "dentista", "medic", "salud", "fisio", "veterin"]):
        extras.extend(["citas", "recepcion", "recepción", "administracion", "administración"])
    if any(x in sector_l for x in ["inmobiliaria", "concesionario", "tienda", "empresa", "servicio"]):
        extras.extend(["ventas", "comercial", "info", "contacto"])
    if any(x in sector_l for x in ["ayuntamiento", "ayuntamientos", "municipal", "administracion publica", "administración pública"]):
        extras.extend(["oac", "registro", "ciudadano", "ciudadana", "buzon", "buzón", "alcaldia", "alcaldía"])

    return extras


def puntuar_correo(email: str, nombre_entidad: str, sector: Optional[str] = None) -> int:
    email = normalizar_email(email)
    if not EMAIL_RE.fullmatch(email):
        return -10_000
    if email.endswith(EXTENSIONES_BASURA):
        return -10_000

    local_part, _, domain = email.partition("@")
    puntos = 0

    nombre_simple = limpiar_nombre_para_match(nombre_entidad)
    domain_simple = re.sub(r"[^a-z0-9]+", "", domain.lower())
    email_simple = re.sub(r"[^a-záéíóúüñ0-9]+", "", email.lower())

    if nombre_simple:
        if nombre_simple in email_simple:
            puntos += 120
        if nombre_simple in domain_simple:
            puntos += 100

    buenas = PALABRAS_EMAIL_BUENO + palabras_extra_por_sector(sector)
    if any(p in email for p in buenas):
        puntos += 70
    if any(p in local_part for p in buenas):
        puntos += 40

    if any(p in email for p in PALABRAS_EMAIL_MALO):
        puntos -= 320
    if any(p in local_part for p in PALABRAS_EMAIL_FALLBACK):
        puntos -= 25

    if domain.endswith((".es", ".com", ".org", ".net", ".edu", ".cat", ".eus", ".gal")):
        puntos += 10
    if email.count(".") > 4:
        puntos -= 40
    if len(local_part) > 35:
        puntos -= 25

    return puntos


def seleccionar_mejor_correo(candidatos: List[str], nombre_entidad: str, sector: Optional[str] = None) -> Optional[str]:
    limpios: List[str] = []

    for candidato in candidatos or []:
        email = normalizar_email(candidato)
        if not email or email.endswith(EXTENSIONES_BASURA):
            continue
        if not EMAIL_RE.fullmatch(email):
            continue
        limpios.append(email)

    limpios = list(dict.fromkeys(limpios))
    if not limpios:
        return None

    puntuados = [(email, puntuar_correo(email, nombre_entidad, sector)) for email in limpios]
    puntuados.sort(key=lambda item: item[1], reverse=True)
    mejor_email, mejor_puntuacion = puntuados[0]

    if len(puntuados) == 1 and mejor_puntuacion > -250:
        return mejor_email
    if mejor_puntuacion >= -30:
        return mejor_email
    return None


# ---------------------------------------------------------------------------
# Descubrimiento de enlaces útiles en web oficial
# ---------------------------------------------------------------------------

def puntuar_enlace_contacto(texto: str, url: str, sector: Optional[str] = None) -> int:
    combo = f"{texto} {url}".lower()
    score = 0

    if any(p in combo for p in ["contacto", "contacta", "contactar", "contact", "contáctenos", "contactenos"]):
        score += 1000
    if any(p in combo for p in ["atencion", "atención", "informacion", "información", "ayuda", "help"]):
        score += 650
    if any(p in combo for p in ["directorio", "oficinas", "delegaciones", "sedes", "ubicacion", "ubicación", "telefono", "teléfono"]):
        score += 500
    if any(p in combo for p in ["quienes-somos", "quienes somos", "quiénes somos", "sobre-nosotros", "sobre nosotros", "equipo", "centro"]):
        score += 350
    if any(p in combo for p in ["administracion", "administración", "secretaria", "secretaría", "recepcion", "recepción"]):
        score += 450
    if any(p in combo for p in ["reservas", "reserva", "booking", "ventas", "comercial", "citas"]):
        score += 450
    if any(p in combo for p in ["ciudadano", "ciudadana", "buzon", "buzón", "oac", "registro"]):
        score += 550
    if "sede" in combo:
        score += 120
    if "ayuntamiento" in combo or "municipal" in combo:
        score += 70
    if any(p in combo for p in ["aviso-legal", "aviso legal", "legal"]):
        score += 80

    basura = [
        "facebook.com/sharer", "twitter.com/share", "x.com/share", "linkedin.com/share",
        "whatsapp://", "wa.me/", "/noticia/", "/noticias/", "/news/", "/blog/",
        "/actualidad/", "/agenda/", "/evento/", "/eventos/", "/rss", "/tag/",
        "/categoria/", "/category/", "/archivo/", "/page/", "/wp-content/",
        "youtube.com", "instagram.com", "facebook.com", "twitter.com", "x.com", "tiktok.com",
    ]
    if any(p in combo for p in basura):
        score -= 2000

    return score


def rutas_probables_genericas(sector: Optional[str] = None) -> List[str]:
    rutas = [
        "/contacto", "/contacta", "/contact", "/contactar", "/contáctenos", "/contactenos",
        "/atencion-al-cliente", "/atencion-cliente", "/atencion-a-la-ciudadania",
        "/web/atencion-a-la-ciudadania", "/informacion", "/directorio", "/oficinas",
        "/quienes-somos", "/sobre-nosotros", "/equipo", "/aviso-legal",
    ]

    sector_l = (sector or "").lower()
    if any(x in sector_l for x in ["ayuntamiento", "municipal", "administracion", "administración"]):
        rutas.extend(["/buzon", "/buzon-ciudadano", "/servicios-ciudadano/buzon-ciudadano", "/registro", "/oac", "/sede"])
    if any(x in sector_l for x in ["coleg", "escuela", "instituto", "academia"]):
        rutas.extend(["/secretaria", "/administracion", "/direccion", "/admisiones"])
    if any(x in sector_l for x in ["hotel", "restaurante", "bar", "cafeter"]):
        rutas.extend(["/reservas", "/booking", "/recepcion"])
    if any(x in sector_l for x in ["clinica", "clínica", "salud", "dentista", "fisio", "veterin"]):
        rutas.extend(["/citas", "/recepcion"])

    return list(dict.fromkeys(rutas))


def descubrir_enlaces_candidatos(
    sopa: Optional[BeautifulSoup],
    url_base: str,
    sector: Optional[str] = None,
    max_reales: int = MAX_ENLACES_REALES_EMAIL,
    max_probables: int = MAX_RUTAS_PROBABLES_EMAIL,
) -> List[str]:
    url_base = normalizar_url(url_base)
    reales: Dict[str, int] = {}

    if sopa:
        for a in sopa.find_all("a", href=True):
            href_original = (a.get("href") or "").strip()
            href_l = href_original.lower()
            if href_l.startswith(("mailto:", "tel:", "javascript:", "#")):
                continue

            url = urljoin(url_base, href_original)
            url, _ = urldefrag(url)

            if not url.startswith(("http://", "https://")):
                continue
            if not es_url_interna(url_base, url):
                continue

            texto = a.get_text(" ", strip=True)
            score = puntuar_enlace_contacto(texto, url, sector)
            if score > 0:
                reales[url] = max(reales.get(url, 0), score)

    enlaces_reales = [
        url for url, _score in sorted(reales.items(), key=lambda item: item[1], reverse=True)
    ][:max_reales]

    probables: List[str] = []
    vistos = set(enlaces_reales)
    for ruta in rutas_probables_genericas(sector):
        url = urljoin(url_base, ruta)
        url, _ = urldefrag(url)
        if url not in vistos:
            probables.append(url)
            vistos.add(url)
        if len(probables) >= max_probables:
            break

    return enlaces_reales + probables


# ---------------------------------------------------------------------------
# Búsqueda profunda de emails
# ---------------------------------------------------------------------------

def crear_sesion_requests() -> requests.Session:
    sesion = requests.Session()
    sesion.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    return sesion


def procesar_url_requests(
    sesion: requests.Session,
    url: str,
    logger: Optional[Callable[[str], None]] = None,
) -> Tuple[List[str], Optional[BeautifulSoup], str, int]:
    try:
        res = sesion.get(
            url,
            timeout=REQUEST_TIMEOUT,
            verify=False,
            allow_redirects=True,
        )
        html = res.text or ""
        emails = extraer_emails_de_html(html)
        sopa = BeautifulSoup(html, "html.parser")

        for a in sopa.find_all("a", href=True):
            href = unquote(unescape((a.get("href") or "").strip()))
            if href.lower().startswith("mailto:"):
                emails.append(normalizar_email(href))

        return emails, sopa, res.url, res.status_code

    except Exception as e:
        log_si(logger, f"      [DEBUG] Error Requests en {url}: {str(e)[:100]}")
        return [], None, url, 0


def extraer_emails_selenium(driver: webdriver.Chrome, logger: Optional[Callable[[str], None]] = None) -> List[str]:
    emails: List[str] = []
    try:
        html = driver.execute_script("return document.documentElement.outerHTML;")
        emails.extend(extraer_emails_de_html(html))
    except Exception as e:
        log_si(logger, f"      [DEBUG] No se pudo leer outerHTML: {str(e)[:80]}")

    try:
        texto = driver.execute_script("return document.body ? document.body.innerText : '';")
        emails.extend([normalizar_email(e) for e in EMAIL_RE.findall(texto or "")])
        emails.extend(extraer_emails_obfuscados(texto or ""))
    except Exception as e:
        log_si(logger, f"      [DEBUG] No se pudo leer innerText: {str(e)[:80]}")

    try:
        for a in driver.find_elements(By.CSS_SELECTOR, "a[href]"):
            href = a.get_attribute("href") or ""
            if href.lower().startswith("mailto:"):
                emails.append(normalizar_email(href))
    except Exception as e:
        log_si(logger, f"      [DEBUG] No se pudieron leer mailto: {str(e)[:80]}")

    return emails


def buscar_correos_profundo(
    url_base: str,
    nombre_entidad: str,
    sector: Optional[str] = None,
    driver: Optional[webdriver.Chrome] = None,
    logger: Optional[Callable[[str], None]] = None,
) -> Optional[str]:
    """
    Busca el mejor email en la web oficial.

    Está limitado para que no bloquee el scraping: primero Requests, luego pocas URLs
    candidatas y Selenium solo como rescate corto.
    """
    url_base = normalizar_url(url_base)
    if not url_base:
        return None

    sesion = crear_sesion_requests()
    emails_home, sopa_home, url_final_home, _status_home = procesar_url_requests(sesion, url_base, logger)

    mejor = seleccionar_mejor_correo(emails_home, nombre_entidad, sector)
    if mejor:
        return mejor

    enlaces = descubrir_enlaces_candidatos(
        sopa_home,
        url_final_home or url_base,
        sector=sector,
        max_reales=MAX_ENLACES_REALES_EMAIL,
        max_probables=MAX_RUTAS_PROBABLES_EMAIL,
    )

    visitadas = set()
    for sub_url in enlaces:
        if sub_url in visitadas:
            continue
        visitadas.add(sub_url)
        log_si(logger, f"      ↳ Analizando URL: {sub_url}")

        emails_sub, sopa_sub, url_final_sub, status_sub = procesar_url_requests(sesion, sub_url, logger)
        mejor_sub = seleccionar_mejor_correo(emails_sub, nombre_entidad, sector)
        if mejor_sub:
            return mejor_sub

        if sopa_sub and 200 <= status_sub < 400:
            sub_enlaces = descubrir_enlaces_candidatos(
                sopa_sub,
                url_final_sub or sub_url,
                sector=sector,
                max_reales=3,
                max_probables=0,
            )
            for sub2_url in sub_enlaces[:3]:
                if sub2_url in visitadas:
                    continue
                visitadas.add(sub2_url)
                log_si(logger, f"      ↳ Analizando URL secundaria: {sub2_url}")
                emails_sub2, _sopa_sub2, _url_final_sub2, _status_sub2 = procesar_url_requests(sesion, sub2_url, logger)
                mejor_sub2 = seleccionar_mejor_correo(emails_sub2, nombre_entidad, sector)
                if mejor_sub2:
                    return mejor_sub2

    if driver is not None:
        urls_selenium = [url_base] + enlaces[:MAX_URLS_SELENIUM_EMAIL]
        urls_selenium = list(dict.fromkeys(urls_selenium))
        for url in urls_selenium:
            try:
                log_si(logger, f"      ↳ Rescate Selenium: {url}")
                driver.get(url)
                time.sleep(1.8)
                emails_dom = extraer_emails_selenium(driver, logger=logger)
                mejor_dom = seleccionar_mejor_correo(emails_dom, nombre_entidad, sector)
                if mejor_dom:
                    return mejor_dom
            except Exception as e:
                log_si(logger, f"      [DEBUG] Error Selenium en {url}: {str(e)[:100]}")
                continue

    return None


# ---------------------------------------------------------------------------
# Google Maps: driver, scrolleo y extracción
# ---------------------------------------------------------------------------

def _primer_path_existente(candidatos: List[Optional[str]]) -> Optional[str]:
    """Devuelve el primer ejecutable existente de una lista de rutas/comandos."""
    for candidato in candidatos:
        if not candidato:
            continue
        candidato = candidato.strip()
        if not candidato:
            continue
        resuelto = shutil.which(candidato) or candidato
        if os.path.exists(resuelto) and os.access(resuelto, os.X_OK):
            return resuelto
    return None


def _detectar_chrome_bin() -> Optional[str]:
    return _primer_path_existente([
        os.getenv("CHROME_BIN"),
        os.getenv("GOOGLE_CHROME_BIN"),
        os.getenv("CHROME_PATH"),
        "chromium",
        "chromium-browser",
        "google-chrome",
        "google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/opt/google/chrome/chrome",
    ])


def _detectar_chromedriver() -> Optional[str]:
    return _primer_path_existente([
        os.getenv("CHROMEDRIVER_PATH"),
        os.getenv("CHROME_DRIVER_PATH"),
        "chromedriver",
        "/usr/bin/chromedriver",
        "/usr/local/bin/chromedriver",
    ])


def _mensaje_chrome_no_disponible(error: Exception) -> str:
    return (
        "No se pudo iniciar el buscador de Google Maps porque no se encontró Google Chrome/Chromium. "
        "Instala Google Chrome en este equipo y vuelve a intentarlo. Si usas una instalación no estándar, "
        "puedes definir CHROME_BIN y CHROMEDRIVER_PATH en .env. "
        f"Detalle: {error}"
    )


def crear_driver() -> webdriver.Chrome:
    opciones = webdriver.ChromeOptions()
    opciones.add_argument("--lang=es-ES")
    opciones.add_argument("--headless=new")
    opciones.add_argument("--disable-blink-features=AutomationControlled")
    opciones.add_argument("--ignore-certificate-errors")
    opciones.add_argument("--allow-insecure-localhost")
    opciones.add_argument("--disable-dev-shm-usage")
    opciones.add_argument("--no-sandbox")
    opciones.add_argument("--disable-gpu")
    opciones.add_argument("--disable-software-rasterizer")
    opciones.add_argument("--disable-extensions")
    opciones.add_argument("--remote-debugging-port=9222")
    opciones.add_argument("--window-size=1400,1100")
    opciones.add_argument(f"user-agent={random.choice(USER_AGENTS)}")
    opciones.add_experimental_option("excludeSwitches", ["enable-automation"])
    opciones.add_experimental_option("useAutomationExtension", False)
    opciones.page_load_strategy = "eager"

    chrome_bin = _detectar_chrome_bin()
    if chrome_bin:
        opciones.binary_location = chrome_bin

    chromedriver_path = _detectar_chromedriver()

    try:
        if chromedriver_path:
            service = Service(chromedriver_path)
        else:
            # Si no hay driver local, webdriver-manager lo resuelve usando Internet.
            service = Service(ChromeDriverManager().install())

        driver = webdriver.Chrome(service=service, options=opciones)
    except WebDriverException as exc:
        mensaje = str(exc).lower()
        if "cannot find chrome binary" in mensaje or "no chrome binary" in mensaje or "chrome binary" in mensaje:
            raise RuntimeError(_mensaje_chrome_no_disponible(exc)) from exc
        raise

    driver.set_page_load_timeout(35)
    driver.set_script_timeout(20)

    try:
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    except Exception:
        pass

    return driver


def aceptar_cookies_maps(driver: webdriver.Chrome) -> None:
    try:
        textos = ["aceptar todo", "accept all", "aceptar", "accept"]
        for boton in driver.find_elements(By.TAG_NAME, "button"):
            texto = (boton.text or boton.get_attribute("aria-label") or "").lower()
            if any(p in texto for p in textos):
                driver.execute_script("arguments[0].click();", boton)
                time.sleep(1.3)
                break
    except Exception:
        pass


def esperar_maps_cargado(driver: webdriver.Chrome, segundos: int = 8) -> None:
    inicio = time.time()
    while time.time() - inicio < segundos:
        try:
            ready_state = driver.execute_script("return document.readyState")
            url_actual = driver.current_url or ""
            if ready_state in {"interactive", "complete"} and "maps.app.goo.gl" not in url_actual:
                return
        except Exception:
            pass
        time.sleep(0.35)


def extraer_coords_desde_url_maps(url: str) -> Tuple[Optional[float], Optional[float]]:
    if not url:
        return None, None

    match = re.search(r"!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)", url)
    if match:
        return float(match.group(1)), float(match.group(2))

    match = re.search(r"@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)", url)
    if match:
        return float(match.group(1)), float(match.group(2))

    return None, None


# Alias que usan otras partes del proyecto.
def extraer_coords_maps_url(url: str) -> Tuple[Optional[float], Optional[float]]:
    return extraer_coords_desde_url_maps(url)


def extraer_nombre_desde_url_maps(url: str) -> Optional[str]:
    if not url:
        return None
    try:
        match = re.search(r"/maps/place/([^/@?]+)", url)
        if not match:
            return None
        nombre = unquote(match.group(1)).replace("+", " ").strip()
        return nombre or None
    except Exception:
        return None


def canonicalizar_url_maps(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    url = url.split("&")[0]
    return url


def obtener_panel_maps(driver: webdriver.Chrome):
    """
    Google Maps re-renderiza el panel continuamente; por eso se busca de nuevo
    en cada iteración y no se reutiliza el WebElement.
    """
    try:
        return driver.execute_script(
            """
            const candidatos = Array.from(document.querySelectorAll(
                "div[role='feed'], div[aria-label*='Resultados para'], div[aria-label*='Results for']"
            ));

            let mejor = null;
            let mejorExtra = -1;

            for (const el of candidatos) {
                const extra = el.scrollHeight - el.clientHeight;
                if (extra > mejorExtra) {
                    mejor = el;
                    mejorExtra = extra;
                }
            }

            if (mejor) return mejor;

            const divs = Array.from(document.querySelectorAll("div"));
            for (const el of divs) {
                const style = window.getComputedStyle(el);
                const scrollable =
                    el.scrollHeight > el.clientHeight + 80 &&
                    ["auto", "scroll"].includes(style.overflowY);

                if (scrollable && el.querySelector("a[href*='/maps/place/']")) {
                    return el;
                }
            }
            return null;
            """
        )
    except Exception:
        return None


def log_estado_maps(driver: webdriver.Chrome, logger: Optional[Callable[[str], None]] = None) -> None:
    try:
        url_actual = driver.current_url or "N/D"
    except Exception:
        url_actual = "N/D"

    try:
        titulo = driver.title or "N/D"
    except Exception:
        titulo = "N/D"

    try:
        texto = driver.execute_script("return document.body ? document.body.innerText.slice(0, 500) : '';") or ""
        texto = " ".join(texto.split())
    except Exception:
        texto = "N/D"

    log_si(logger, f"[DEBUG MAPS] URL actual: {url_actual[:250]}")
    log_si(logger, f"[DEBUG MAPS] Título: {titulo[:150]}")
    log_si(logger, f"[DEBUG MAPS] Texto visible: {texto[:300]}")


def esperar_lista_o_ficha_maps(driver: webdriver.Chrome, logger: Optional[Callable[[str], None]] = None, segundos: int = 25) -> bool:
    try:
        WebDriverWait(driver, segundos).until(
            lambda d: (
                len(d.find_elements(By.CSS_SELECTOR, "a[href*='/maps/place/']")) > 0
                or "/maps/place/" in (d.current_url or "")
                or obtener_panel_maps(d) is not None
            )
        )
        return True
    except TimeoutException:
        log_si(logger, "No apareció lista ni ficha directa de Google Maps tras esperar.")
        log_estado_maps(driver, logger)
        return False


def _extraer_nombre_de_elemento_o_url(elemento, href: str) -> Optional[str]:
    try:
        texto = (elemento.get_attribute("aria-label") or elemento.text or "").strip()
        if texto:
            return texto.split("\n")[0].strip()
    except Exception:
        pass
    return extraer_nombre_desde_url_maps(href)


def _recoger_fichas_visibles(
    driver: webdriver.Chrome,
    sector_asignado: str,
    fichas_raw: List[Dict[str, Any]],
    vistos: set[str],
) -> int:
    nuevos = 0
    try:
        elementos = driver.find_elements(By.CSS_SELECTOR, "a[href*='/maps/place/']")
    except Exception:
        return 0

    for e in elementos:
        try:
            href = e.get_attribute("href") or ""
            if "/maps/place/" not in href:
                continue

            url_maps = canonicalizar_url_maps(href)
            if not url_maps or url_maps in vistos:
                continue

            nombre = _extraer_nombre_de_elemento_o_url(e, href)
            if not nombre:
                continue

            latitud, longitud = extraer_coords_desde_url_maps(href)
            vistos.add(url_maps)
            fichas_raw.append({
                "nombre": nombre,
                "latitud": latitud,
                "longitud": longitud,
                "url_maps": url_maps,
                "sector": sector_asignado,
                "fase": 1,
            })
            nuevos += 1
        except StaleElementReferenceException:
            continue
        except Exception:
            continue

    return nuevos


def _recoger_ficha_directa_si_existe(
    driver: webdriver.Chrome,
    sector_asignado: str,
    fichas_raw: List[Dict[str, Any]],
    vistos: set[str],
    logger: Optional[Callable[[str], None]] = None,
) -> int:
    try:
        url_actual = driver.current_url or ""
    except Exception:
        return 0

    if "/maps/place/" not in url_actual:
        return 0

    url_maps = canonicalizar_url_maps(url_actual)
    if not url_maps or url_maps in vistos:
        return 0

    nombre = None
    try:
        for el in driver.find_elements(By.CSS_SELECTOR, "h1"):
            texto = (el.text or "").strip()
            if texto:
                nombre = texto
                break
    except Exception:
        pass

    if not nombre:
        nombre = extraer_nombre_desde_url_maps(url_actual) or "Ficha de Google Maps"

    latitud, longitud = extraer_coords_desde_url_maps(url_actual)
    vistos.add(url_maps)
    fichas_raw.append({
        "nombre": nombre,
        "latitud": latitud,
        "longitud": longitud,
        "url_maps": url_maps,
        "sector": sector_asignado,
        "fase": 1,
    })
    log_si(logger, f"Ficha directa detectada en Maps: {nombre}")
    return 1


def extraer_fichas_maps(
    driver: webdriver.Chrome,
    sector_asignado: str,
    modo_prueba: bool,
    logger: Optional[Callable[[str], None]] = None,
) -> List[Dict[str, Any]]:
    """
    Baja el panel de Google Maps hasta el fondo real o hasta estabilidad.

    Protecciones:
    - Rebusca el panel en cada vuelta para evitar stale element.
    - Acepta listas y fichas directas.
    - No exige coordenadas en el enlace inicial.
    - Tiene límites por scrolls, tiempo, fondo sin nuevos y estabilidad.
    """
    max_scrolls = 8 if modo_prueba else 120
    max_sin_cambios = 3 if modo_prueba else 14
    max_fondo_sin_nuevos = 3 if modo_prueba else 7
    max_segundos = 35 if modo_prueba else 150

    fichas_raw: List[Dict[str, Any]] = []
    vistos: set[str] = set()
    inicio = time.time()

    if not esperar_lista_o_ficha_maps(driver, logger, segundos=18 if modo_prueba else 25):
        return fichas_raw

    _recoger_ficha_directa_si_existe(driver, sector_asignado, fichas_raw, vistos, logger)

    sin_cambios = 0
    veces_en_fondo = 0
    ultimo_total = -1
    ultimo_scroll_top = -1
    ultimo_scroll_height = -1

    for intento in range(1, max_scrolls + 1):
        if time.time() - inicio > max_segundos:
            log_si(logger, f"Scroll cortado por seguridad: {max_segundos}s máximo por búsqueda.")
            break

        nuevos = _recoger_fichas_visibles(driver, sector_asignado, fichas_raw, vistos)
        nuevos += _recoger_ficha_directa_si_existe(driver, sector_asignado, fichas_raw, vistos, logger)

        panel = obtener_panel_maps(driver)
        if panel is None:
            total_actual = len(fichas_raw)
            log_si(logger, f"Scroll {intento}/{max_scrolls}: sin panel scrollable | fichas: {total_actual}")
            if total_actual > 0:
                break
            log_estado_maps(driver, logger)
            sin_cambios += 1
            if sin_cambios >= max_sin_cambios:
                break
            time.sleep(1.5)
            continue

        try:
            scroll_top = driver.execute_script("return arguments[0].scrollTop;", panel) or 0
            scroll_height = driver.execute_script("return arguments[0].scrollHeight;", panel) or 0
            client_height = driver.execute_script("return arguments[0].clientHeight;", panel) or 0
        except (StaleElementReferenceException, JavascriptException):
            log_si(logger, "Panel stale/error JS al medir. Se reintentará.")
            time.sleep(0.8)
            continue

        total_actual = len(fichas_raw)
        log_si(
            logger,
            f"Scroll {intento}/{max_scrolls}: {total_actual} fichas | nuevas: {nuevos} | "
            f"top: {int(scroll_top)} | height: {int(scroll_height)} | client: {int(client_height)}",
        )

        try:
            texto_body = driver.execute_script("return document.body ? document.body.innerText : '';") or ""
            if any(t in texto_body for t in [
                "Has llegado al final de la lista",
                "Has llegado al final",
                "You've reached the end of the list",
            ]):
                log_si(logger, "Final real detectado en Google Maps.")
                break
        except Exception:
            pass

        esta_en_fondo = bool(scroll_height and client_height and scroll_top + client_height >= scroll_height - 5)
        if esta_en_fondo and nuevos == 0:
            veces_en_fondo += 1
        else:
            veces_en_fondo = 0

        if veces_en_fondo >= max_fondo_sin_nuevos:
            log_si(logger, "Scroll completado: fondo del panel alcanzado sin nuevas fichas tras varios intentos.")
            break

        sin_nuevas = total_actual == ultimo_total
        sin_mover = scroll_top == ultimo_scroll_top
        sin_crecer = scroll_height == ultimo_scroll_height
        if sin_nuevas and sin_mover and sin_crecer:
            sin_cambios += 1
        else:
            sin_cambios = 0

        if sin_cambios >= max_sin_cambios:
            log_si(logger, f"Se para el scroll: {max_sin_cambios} intentos sin nuevas fichas ni movimiento.")
            break

        ultimo_total = total_actual
        ultimo_scroll_top = scroll_top
        ultimo_scroll_height = scroll_height

        try:
            panel = obtener_panel_maps(driver)
            if panel is not None:
                driver.execute_script(
                    """
                    const el = arguments[0];
                    el.scrollTop = el.scrollHeight;
                    el.dispatchEvent(new WheelEvent('wheel', {
                        deltaY: 16000,
                        bubbles: true,
                        cancelable: true
                    }));
                    """,
                    panel,
                )
                try:
                    panel.send_keys(Keys.END)
                except Exception:
                    pass
        except StaleElementReferenceException:
            log_si(logger, "Panel stale durante scroll. Se recuperará en la siguiente vuelta.")
        except Exception as e:
            log_si(logger, f"Aviso haciendo scroll: {type(e).__name__}: {str(e)[:120]}")

        time.sleep(1.9 if not modo_prueba else 1.2)

    _recoger_fichas_visibles(driver, sector_asignado, fichas_raw, vistos)
    _recoger_ficha_directa_si_existe(driver, sector_asignado, fichas_raw, vistos, logger)

    return fichas_raw[:3] if modo_prueba else fichas_raw


def extraer_web_oficial_maps(driver: webdriver.Chrome) -> Optional[str]:
    selectores = [
        "a[data-item-id='authority']",
        "a[aria-label^='Sitio web']",
        "a[aria-label*='Sitio web']",
        "a[aria-label*='Website']",
        "a[href^='http'][jsaction*='pane.wfvdle']",
    ]

    for selector in selectores:
        try:
            enlaces = driver.find_elements(By.CSS_SELECTOR, selector)
            for enlace in enlaces:
                href = enlace.get_attribute("href") or ""
                if href.startswith(("http://", "https://")) and "google." not in href.lower():
                    return href.split("?")[0]
        except Exception:
            pass

    dominios_excluidos = [
        "google.", "gstatic.", "ggpht.", "schema.org", "facebook.com/sharer",
        "twitter.com/share", "x.com/share", "wa.me", "whatsapp", "instagram.com", "youtube.com",
    ]

    try:
        for a in driver.find_elements(By.CSS_SELECTOR, "a[href]"):
            href = a.get_attribute("href") or ""
            href_l = href.lower()
            if not href_l.startswith(("http://", "https://")):
                continue
            if any(d in href_l for d in dominios_excluidos):
                continue
            return href.split("?")[0]
    except Exception:
        pass

    return None


def convertir_numero_resenas(texto: str):
    if not texto:
        return None
    texto = texto.lower().replace("\xa0", " ").strip()

    match_mil = re.search(r"(\d+(?:[,.]\d+)?)\s*mil\s*(?:reseñ|opiniones|reviews)", texto, re.I)
    if match_mil:
        valor = match_mil.group(1).replace(",", ".")
        return int(float(valor) * 1000)

    for patron in [r"\(([\d][\d., ]*)\)", r"([\d][\d., ]*)\s*(?:reseñ|opiniones|reviews)"]:
        match = re.search(patron, texto, re.I)
        if not match:
            continue
        bruto = match.group(1).strip()
        if re.fullmatch(r"[1-5][,.]\d{1,2}", bruto):
            continue
        solo_digitos = re.sub(r"\D", "", bruto)
        if solo_digitos:
            numero = int(solo_digitos)
            if numero >= 1:
                return numero
    return None


def convertir_valoracion(texto: str):
    if not texto:
        return None
    texto = texto.lower().replace("\xa0", " ").strip()
    patrones = [
        r"([1-5](?:[,.]\d{1,2})?)\s*(?:de\s*5\s*)?(?:estrellas|stars)",
        r"valoraci[oó]n[:\s]+([1-5](?:[,.]\d{1,2})?)",
        r"rating[:\s]+([1-5](?:[,.]\d{1,2})?)",
    ]
    for patron in patrones:
        match = re.search(patron, texto, re.I)
        if not match:
            continue
        try:
            valor = float(match.group(1).replace(",", "."))
            if 0 <= valor <= 5:
                return valor
        except Exception:
            pass

    if re.fullmatch(r"[1-5](?:[,.]\d{1,2})?", texto):
        try:
            valor = float(texto.replace(",", "."))
            if 0 <= valor <= 5:
                return valor
        except Exception:
            pass
    return None


def extraer_valoracion_maps(driver):
    selectores = [
        "div.F7nice span[aria-hidden='true']",
        "span[aria-label*='estrellas']",
        "span[aria-label*='stars']",
        "div[role='img'][aria-label*='estrellas']",
        "div[role='img'][aria-label*='stars']",
        "span.ceNzKf[role='img']",
        "button[aria-label*='estrellas']",
        "button[aria-label*='stars']",
    ]
    for selector in selectores:
        try:
            for el in driver.find_elements(By.CSS_SELECTOR, selector):
                for texto in [el.get_attribute("aria-label") or "", el.get_attribute("textContent") or "", el.text or ""]:
                    valor = convertir_valoracion(texto)
                    if valor is not None:
                        return valor
        except Exception:
            pass

    try:
        texto_pagina = driver.execute_script("return document.body ? document.body.innerText : '';") or ""
        for patron in [
            r"\b([1-5][,.]\d)\s*(?:estrellas|stars)",
            r"\b([1-5][,.]\d)\s*\n?\s*\(?[\d., ]+\s*(?:reseñ|opiniones|reviews)",
        ]:
            match = re.search(patron, texto_pagina, re.I)
            if match:
                valor = float(match.group(1).replace(",", "."))
                if 0 <= valor <= 5:
                    return valor
    except Exception:
        pass
    return None


def extraer_num_resenas_maps(driver):
    candidatos = []

    for selector in ["div.F7nice", "div[role='main'] div.F7nice"]:
        try:
            for el in driver.find_elements(By.CSS_SELECTOR, selector):
                textos = [el.get_attribute("aria-label") or "", el.get_attribute("textContent") or "", el.text or ""]
                try:
                    for hijo in el.find_elements(By.CSS_SELECTOR, "[aria-label]"):
                        textos.append(hijo.get_attribute("aria-label") or "")
                        textos.append(hijo.text or "")
                except Exception:
                    pass
                for texto in textos:
                    num = convertir_numero_resenas(texto)
                    if num is not None:
                        candidatos.append(num)
                if candidatos:
                    return max(candidatos)
        except Exception:
            pass

    for selector in [
        "button[aria-label*='reseña']", "button[aria-label*='reseñas']",
        "button[aria-label*='opiniones']", "button[aria-label*='reviews']",
        "span[aria-label*='reseña']", "span[aria-label*='reseñas']",
        "span[aria-label*='opiniones']", "span[aria-label*='reviews']",
        "button[jsaction*='pane.reviewChart']", "button[jsaction*='pane.rating.moreReviews']",
    ]:
        try:
            for el in driver.find_elements(By.CSS_SELECTOR, selector):
                for texto in [el.get_attribute("aria-label") or "", el.get_attribute("textContent") or "", el.text or ""]:
                    num = convertir_numero_resenas(texto)
                    if num is not None:
                        candidatos.append(num)
        except Exception:
            pass

    if candidatos:
        return max(candidatos)

    try:
        texto_pagina = driver.execute_script("return document.body ? document.body.innerText : '';") or ""
        lineas = [linea.strip() for linea in texto_pagina.splitlines() if linea.strip()]
        num = convertir_numero_resenas("\n".join(lineas[:25]))
        if num is not None:
            return num
    except Exception:
        pass
    return None


def extraer_texto_primer_selector(driver, selectores: List[str]) -> Optional[str]:
    for selector in selectores:
        try:
            for elemento in driver.find_elements(By.CSS_SELECTOR, selector):
                texto = (elemento.text or "").strip()
                if texto:
                    return texto
                aria = (elemento.get_attribute("aria-label") or "").strip()
                if aria:
                    return aria
        except Exception:
            continue
    return None


def limpiar_categoria_maps(texto: Optional[str]) -> Optional[str]:
    if texto is None:
        return None
    texto = str(texto).strip()
    if not texto:
        return None
    texto = texto.replace("Categoría:", "").replace("Categoria:", "").replace("Category:", "").strip()
    if "\n" in texto:
        texto = texto.split("\n")[0].strip()
    texto_l = texto.lower()
    if texto_l in {
        "sitio web", "indicaciones", "guardar", "llamar", "compartir", "reseñas", "resenas",
        "fotos", "enviar", "abrir", "cerrar", "más", "mas",
    }:
        return None
    if len(texto) > 80:
        return None
    if re.fullmatch(r"[\d\s()+.-]+", texto):
        return None
    return texto


def extraer_nombre_categoria_visual_maps(driver) -> Tuple[Optional[str], Optional[str]]:
    nombre = extraer_texto_primer_selector(driver, ["h1.DUwDvf", "h1[class*='DUwDvf']", "div[role='main'] h1", "h1"])
    categoria = None
    for selector in [
        "button[jsaction*='pane.rating.category']", "button.DkEaL", "button[class*='DkEaL']",
        "div.DkEaL", "span.DkEaL", "button[aria-label*='Categoría']",
        "button[aria-label*='Categoria']", "button[aria-label*='Category']",
    ]:
        try:
            for elemento in driver.find_elements(By.CSS_SELECTOR, selector):
                candidato = limpiar_categoria_maps(elemento.text)
                if not candidato:
                    candidato = limpiar_categoria_maps(elemento.get_attribute("aria-label"))
                if candidato:
                    categoria = candidato
                    break
            if categoria:
                break
        except Exception:
            continue
    return nombre, categoria


def parece_direccion_no_ciudad(texto: str) -> bool:
    if not texto:
        return True
    t = normalizar_texto_simple(texto)
    if any(p in t for p in PALABRAS_DIRECCION):
        return True
    if re.search(r"\d", t):
        return True
    return False


def limpiar_ciudad_candidata(texto: str) -> Optional[str]:
    if not texto:
        return None
    ciudad = texto.strip()
    ciudad = re.sub(r"\b\d{5}\b", "", ciudad).strip()
    ciudad = re.sub(r"\s+", " ", ciudad).strip(" ,-")
    if not ciudad:
        return None
    ciudad_norm = normalizar_texto_simple(ciudad)
    if ciudad_norm in PROVINCIAS_O_TERRITORIOS:
        return None
    if parece_direccion_no_ciudad(ciudad):
        return None
    return ciudad


def extraer_ciudad_desde_direccion(direccion: str) -> Optional[str]:
    if not direccion:
        return None
    partes = [p.strip() for p in direccion.split(",") if p.strip()]
    if not partes:
        return None

    for parte in partes:
        match = re.search(r"\b\d{5}\b\s+(.+)$", parte.strip())
        if match:
            ciudad = limpiar_ciudad_candidata(match.group(1))
            if ciudad:
                return ciudad

    if len(partes) >= 3:
        for parte in reversed(partes[:-1]):
            ciudad = limpiar_ciudad_candidata(parte)
            if ciudad:
                return ciudad

    if len(partes) == 2:
        posible = limpiar_ciudad_candidata(partes[0])
        if posible:
            return posible

    return None


def extraer_datos_ficha_maps(driver: webdriver.Chrome, sector_asignado: str) -> Dict[str, Any]:
    datos: Dict[str, Any] = {
        "nombre": None,
        "sitio_web": None,
        "telefono": None,
        "direccion": None,
        "ciudad": None,
        "valoracion": None,
        "num_resenas": None,
        "categoria_google": None,
        "latitud": None,
        "longitud": None,
        "url_maps": None,
    }

    url_actual = driver.current_url or ""
    datos["url_maps"] = canonicalizar_url_maps(url_actual) if "/maps/" in url_actual else None
    lat, lon = extraer_coords_desde_url_maps(url_actual)
    datos["latitud"] = lat
    datos["longitud"] = lon

    nombre_visual, categoria_visual = extraer_nombre_categoria_visual_maps(driver)
    datos["nombre"] = nombre_visual or extraer_nombre_desde_url_maps(url_actual)
    datos["categoria_google"] = categoria_visual or sector_asignado

    try:
        for selector in ["button[data-item-id^='phone:']", "button[aria-label^='Teléfono']", "button[aria-label^='Phone']"]:
            botones = driver.find_elements(By.CSS_SELECTOR, selector)
            for btn in botones:
                texto = btn.get_attribute("aria-label") or btn.text or ""
                texto = texto.replace("Teléfono:", "").replace("Phone:", "").strip()
                if texto:
                    datos["telefono"] = texto
                    raise StopIteration
    except StopIteration:
        pass
    except Exception:
        pass

    try:
        for selector in ["button[data-item-id='address']", "button[aria-label^='Dirección']", "button[aria-label^='Address']"]:
            botones = driver.find_elements(By.CSS_SELECTOR, selector)
            for btn in botones:
                direccion = (btn.get_attribute("aria-label") or btn.text or "").replace("Dirección:", "").replace("Address:", "").strip()
                if direccion:
                    datos["direccion"] = direccion
                    ciudad = extraer_ciudad_desde_direccion(direccion)
                    if ciudad:
                        datos["ciudad"] = ciudad
                    raise StopIteration
    except StopIteration:
        pass
    except Exception:
        pass

    datos["valoracion"] = extraer_valoracion_maps(driver)
    datos["num_resenas"] = extraer_num_resenas_maps(driver)
    datos["sitio_web"] = extraer_web_oficial_maps(driver)

    return datos


# ---------------------------------------------------------------------------
# Generador principal
# ---------------------------------------------------------------------------

def ejecutar_busqueda(
    termino_busqueda: str,
    sector_asignado: str,
    modo_prueba: bool = False,
    logger=None,
    urls_maps_omitidas: set[str] | None = None,
    email_ya_existe: Optional[Callable[[str], bool]] = None,
):
    """
    Generador principal usado por el frontend.

    - Scrollea hasta fondo real/estabilidad con límites anti-bucle.
    - No descarta fichas sin web ni email.
    - Guarda ficha básica aunque falten datos de contacto.
    - Evita trabajo profundo si la URL de Maps ya está en BD.
    """
    def log(msg: str):
        if logger:
            logger(msg)

    urls_maps_omitidas = {canonicalizar_url_maps(u) for u in set(urls_maps_omitidas or []) if u}
    driver = crear_driver()

    try:
        termino_busqueda = (termino_busqueda or "").strip()
        if not termino_busqueda:
            log("Término de búsqueda vacío.")
            return

        log(f"🔎 Fase 1: Rastreo superficial en Maps para: {termino_busqueda}")
        url = f"https://www.google.es/maps/search/{quote_plus(termino_busqueda)}"

        try:
            driver.get(url)
        except TimeoutException:
            try:
                driver.execute_script("window.stop();")
            except Exception:
                pass

        esperar_maps_cargado(driver, segundos=7)
        aceptar_cookies_maps(driver)
        time.sleep(1.2)

        log("Forzando paginación para obtener más resultados...")
        fichas = extraer_fichas_maps(driver, sector_asignado, modo_prueba, log)

        log(f"📍 Mapeados {len(fichas)} negocios. Enviando a la pantalla...")
        for ficha in fichas:
            yield ficha

        log("🧠 Fase 2: Iniciando extracción profunda uno a uno...")

        for idx, ficha in enumerate(fichas, 1):
            url_maps = canonicalizar_url_maps(ficha.get("url_maps") or "")
            if not url_maps:
                continue

            if url_maps in urls_maps_omitidas:
                log(f"[{idx}/{len(fichas)}] Saltado por duplicado en BD: {ficha.get('nombre')}")
                yield {
                    "url_maps": url_maps,
                    "nombre": ficha.get("nombre"),
                    "latitud": ficha.get("latitud"),
                    "longitud": ficha.get("longitud"),
                    "sector": sector_asignado,
                    "categoria_google": sector_asignado,
                    "termino_busqueda": termino_busqueda,
                    "fase": "duplicado_url_maps",
                }
                continue

            yield {
                "url_maps": url_maps,
                "latitud": ficha.get("latitud"),
                "longitud": ficha.get("longitud"),
                "fase": "moviendo_mapa",
            }

            log(f"[{idx}/{len(fichas)}] Analizando: {ficha.get('nombre')}...")

            datos = {
                "nombre": ficha.get("nombre"),
                "sitio_web": None,
                "telefono": None,
                "direccion": None,
                "ciudad": None,
                "valoracion": None,
                "num_resenas": None,
                "categoria_google": sector_asignado,
                "latitud": ficha.get("latitud"),
                "longitud": ficha.get("longitud"),
                "url_maps": url_maps,
            }

            try:
                try:
                    driver.get(url_maps)
                except TimeoutException:
                    try:
                        driver.execute_script("window.stop();")
                    except Exception:
                        pass

                esperar_maps_cargado(driver, segundos=7)
                aceptar_cookies_maps(driver)
                time.sleep(1.2)

                datos_extraidos = extraer_datos_ficha_maps(driver, sector_asignado)
                for clave, valor in datos_extraidos.items():
                    if valor is not None and valor != "":
                        datos[clave] = valor

                if datos.get("latitud") is None or datos.get("longitud") is None:
                    lat_actual, lon_actual = extraer_coords_desde_url_maps(driver.current_url or "")
                    if lat_actual is not None and lon_actual is not None:
                        datos["latitud"] = lat_actual
                        datos["longitud"] = lon_actual

            except Exception as e:
                log(f"  ↳ Error abriendo ficha de Maps. Se guardará ficha básica: {str(e)[:100]}")

            sitio_web = datos.get("sitio_web")
            email = None

            if sitio_web:
                log(f"  ↳ Web encontrada: {sitio_web}")
                log("  ↳ Buscando correos en web oficial...")
                try:
                    email = buscar_correos_profundo(
                        sitio_web,
                        datos.get("nombre") or ficha.get("nombre") or "",
                        sector=sector_asignado,
                        driver=driver,
                        logger=logger,
                    )
                except Exception as e:
                    log(f"  ↳ Error buscando email. Se guardará sin correo: {str(e)[:100]}")

                if email:
                    log(f"  ↳ ¡ÉXITO! Email: {email}")
                else:
                    log("  ↳ Sin email. Se guardará la ficha igualmente.")

                if email and email_ya_existe:
                    try:
                        if email_ya_existe(email):
                            log(f"  ↳ Email ya existente en BD. Se salta guardado: {email}")
                            yield {
                                "url_maps": url_maps,
                                "nombre": datos.get("nombre") or ficha.get("nombre"),
                                "email": email,
                                "sitio_web": sitio_web,
                                "telefono": datos.get("telefono"),
                                "direccion": datos.get("direccion"),
                                "ciudad": datos.get("ciudad"),
                                "latitud": datos.get("latitud"),
                                "longitud": datos.get("longitud"),
                                "valoracion": datos.get("valoracion"),
                                "num_resenas": datos.get("num_resenas"),
                                "categoria_google": datos.get("categoria_google") or sector_asignado,
                                "sector": sector_asignado,
                                "termino_busqueda": termino_busqueda,
                                "fase": "duplicado_email",
                            }
                            continue
                    except Exception as e:
                        log(f"  ↳ No se pudo comprobar duplicado por email: {str(e)[:100]}")
            else:
                log("  ↳ Sin web. Se guardará la ficha igualmente con los datos disponibles.")

            yield {
                "url_maps": url_maps,
                "nombre": datos.get("nombre") or ficha.get("nombre"),
                "email": email,
                "sitio_web": sitio_web,
                "telefono": datos.get("telefono"),
                "direccion": datos.get("direccion"),
                "ciudad": datos.get("ciudad"),
                "latitud": datos.get("latitud"),
                "longitud": datos.get("longitud"),
                "valoracion": datos.get("valoracion"),
                "num_resenas": datos.get("num_resenas"),
                "categoria_google": datos.get("categoria_google") or sector_asignado,
                "sector": sector_asignado,
                "termino_busqueda": termino_busqueda,
                "fase": 2,
            }

    except Exception as e:
        log(f"Error crítico en scraper: {str(e)[:200]}")

    finally:
        try:
            driver.quit()
        except Exception:
            pass

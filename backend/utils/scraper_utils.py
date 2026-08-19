"""
Utilidades compartidas para el scraper.

Este módulo no abre Selenium ni toca la base de datos. Contiene:
- normalización de texto, URLs y emails
- extracción y scoring de emails
- descubrimiento de enlaces internos de contacto
- helpers de Google Maps URL/coordenadas
- extracción de ciudad desde direcciones
- expansión de búsquedas para ayuntamientos/provincias

Colócalo como: backend/utils/scraper_utils.py
"""

from __future__ import annotations

import json
import os
import random
import re
import unicodedata
from html import unescape
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
from urllib.parse import unquote, urljoin, urlparse, urldefrag

import requests
import urllib3
from bs4 import BeautifulSoup

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

Logger = Optional[Callable[[str], None]]


# ---------------------------------------------------------------------------
# Configuración general
# ---------------------------------------------------------------------------

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

EMAIL_RE = re.compile(
    r"(?<![\w.-])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?![\w.-])"
)

MAILTO_RE = re.compile(r"mailto:\s*([^\"'<>\s]+)", re.IGNORECASE)

EXTENSIONES_BASURA = (
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif",
    ".js", ".css", ".ico", ".pdf", ".mp4", ".webm", ".zip",
)

PALABRAS_EMAIL_BUENO = [
    "info", "contacto", "contact", "hola", "hello", "general",
    "atencion", "atención", "cliente", "clientes", "ciudadano", "ciudadana",
    "buzon", "buzón", "oficina", "administracion", "administración",
    "administ", "secretaria", "secretaría", "recepcion", "recepción",
    "reservas", "reserva", "booking", "comercial", "ventas", "direccion",
    "dirección", "gerencia", "rrhh", "personal", "admisiones", "matricula",
    "matrícula", "citas", "oac", "registro", "ayto", "ayuntamiento",
    "alcaldia", "alcaldía", "sac", "sugerencias", "incidencias",
]

PALABRAS_EMAIL_MALO = [
    "protecciondedatos", "protección.datos", "proteccion.datos", "datos",
    "dpo", "dpd", "lopd", "rgpd", "gdpr", "privacidad", "privacy",
    "cookies", "transparencia", "noreply", "no-reply", "donotreply",
    "notificaciones", "notification", "notifications", "newsletter", "robot",
    "sistemas", "informatica", "informática", "soporte", "support", "abuse",
    "postmaster", "hostmaster", "webmaster", "sedena", "maltamira",
]

PALABRAS_EMAIL_FALLBACK = ["admin", "administrador", "portal", "web"]

PROVINCIAS_O_TERRITORIOS = {
    "alava", "álava", "araba", "albacete", "alicante", "alacant",
    "almeria", "almería", "asturias", "avila", "ávila", "badajoz",
    "barcelona", "burgos", "caceres", "cáceres", "cadiz", "cádiz",
    "cantabria", "castellon", "castellón", "ciudad real", "cordoba",
    "córdoba", "cuenca", "girona", "gerona", "granada", "guadalajara",
    "gipuzkoa", "guipuzcoa", "huelva", "huesca", "illes balears",
    "islas baleares", "jaen", "jaén", "la coruña", "a coruña", "la rioja",
    "las palmas", "leon", "león", "lleida", "lerida", "lérida", "lugo",
    "madrid", "malaga", "málaga", "murcia", "navarra", "ourense", "orense",
    "palencia", "pontevedra", "salamanca", "santa cruz de tenerife",
    "segovia", "sevilla", "soria", "tarragona", "teruel", "toledo",
    "valencia", "valladolid", "bizkaia", "vizcaya", "zamora", "zaragoza",
    "españa", "spain",
}

PALABRAS_DIRECCION = [
    "calle", "c/", "plaza", "avda", "avenida", "barrio", "carretera",
    "ctra", "camino", "paseo", "travesia", "travesía", "poligono",
    "polígono", "urbanizacion", "urbanización", "edificio", "portal", "nº",
    "num", "número", "numero", "km", "ronda", "glorieta", "parque",
]


# ---------------------------------------------------------------------------
# Logging y normalización
# ---------------------------------------------------------------------------

def log_si(logger: Logger, msg: str) -> None:
    if logger:
        logger(msg)


def sin_acentos(texto: str) -> str:
    texto = str(texto or "")
    normalizado = unicodedata.normalize("NFD", texto)
    return "".join(c for c in normalizado if unicodedata.category(c) != "Mn")


def normalizar_texto_simple(texto: str) -> str:
    texto = sin_acentos(str(texto or "")).lower().strip()
    texto = texto.replace(".", " ")
    texto = re.sub(r"\s+", " ", texto)
    return texto


def clave_limpia(texto: str) -> str:
    texto = normalizar_texto_simple(texto)
    return re.sub(r"[^a-z0-9]+", "", texto)


def valor_util(valor: Any) -> Optional[str]:
    if valor is None:
        return None

    texto = str(valor).strip()
    if not texto:
        return None

    if texto.lower() in {
        "n/d", "sin sector", "sin categoría", "sin categoria", "none", "null",
        "undefined", "nan",
    }:
        return None

    return texto


def normalizar_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return url
    if not url.startswith(("http://", "https://")):
        return "https://" + url
    return url


def dominio_limpio(url: str) -> str:
    return urlparse(url or "").netloc.lower().replace("www.", "")


def es_url_interna(url_base: str, url: str) -> bool:
    base = dominio_limpio(url_base)
    dom = dominio_limpio(url)

    if not base or not dom:
        return True

    return dom == base or dom.endswith("." + base)


def limpiar_nombre_para_match(texto: str) -> str:
    texto = normalizar_texto_simple(texto)
    for prefijo in [
        "ayuntamiento de ", "ayuntamiento ", "gobierno de ", "colegio de ",
        "colegio ", "instituto de ", "instituto ", "restaurante ", "hotel ",
        "clinica ", "clínica ", "empresa ",
    ]:
        texto = texto.replace(prefijo, "")
    return re.sub(r"[^a-z0-9]+", "", texto.strip())


# ---------------------------------------------------------------------------
# Emails
# ---------------------------------------------------------------------------

def normalizar_email(valor: str) -> str:
    valor = unquote(unescape(valor or "")).strip()

    if valor.lower().startswith("mailto:"):
        valor = valor[7:]

    valor = valor.split("?")[0]
    valor = valor.split("&subject=")[0]
    valor = valor.split("&body=")[0]
    valor = valor.strip(" \t\r\n.,;:()[]<>\"'")
    return valor.lower()


def email_valido_formato(email: Optional[str]) -> bool:
    if not email:
        return False
    email = normalizar_email(email)
    if email.endswith(EXTENSIONES_BASURA):
        return False
    return bool(EMAIL_RE.fullmatch(email))


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
    normalizado = re.sub(r"\s+at\s+", " @ ", normalizado, flags=re.I)
    normalizado = re.sub(r"\s+dot\s+", " . ", normalizado, flags=re.I)

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
    return list(dict.fromkeys(candidatos))


def palabras_extra_por_sector(sector: Optional[str]) -> List[str]:
    sector_l = normalizar_texto_simple(sector or "")
    extras: List[str] = []

    if any(x in sector_l for x in ["coleg", "escuela", "instituto", "academia", "universidad"]):
        extras.extend(["secretaria", "direccion", "admisiones", "matricula"])

    if any(x in sector_l for x in ["restaurante", "bar", "cafeter", "hotel", "hostal", "alojamiento"]):
        extras.extend(["reservas", "reserva", "booking", "recepcion"])

    if any(x in sector_l for x in ["clinica", "dentista", "medic", "salud", "fisio", "veterin"]):
        extras.extend(["citas", "recepcion", "administracion"])

    if any(x in sector_l for x in ["inmobiliaria", "concesionario", "tienda", "empresa", "servicio"]):
        extras.extend(["ventas", "comercial", "info", "contacto"])

    if any(x in sector_l for x in ["ayuntamiento", "ayuntamientos", "municipal", "administracion publica"]):
        extras.extend(["oac", "registro", "ciudadano", "buzon", "alcaldia", "ayto"])

    return extras


def puntuar_correo(email: str, nombre_entidad: str, sector: Optional[str] = None) -> int:
    email = normalizar_email(email)

    if not email_valido_formato(email):
        return -10_000

    local_part, _, domain = email.partition("@")
    puntos = 0

    nombre_simple = limpiar_nombre_para_match(nombre_entidad)
    domain_simple = re.sub(r"[^a-z0-9]+", "", sin_acentos(domain.lower()))
    email_simple = re.sub(r"[^a-z0-9]+", "", sin_acentos(email.lower()))

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


def seleccionar_mejor_correo(
    candidatos: Iterable[str],
    nombre_entidad: str,
    sector: Optional[str] = None,
) -> Optional[str]:
    limpios: List[str] = []

    for candidato in candidatos or []:
        email = normalizar_email(candidato)
        if email_valido_formato(email):
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
# Requests / enlaces de contacto
# ---------------------------------------------------------------------------

def crear_sesion_requests() -> requests.Session:
    sesion = requests.Session()
    sesion.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Connection": "close",
    })
    return sesion


def procesar_url_requests(
    sesion: requests.Session,
    url: str,
    logger: Logger = None,
    timeout: int = 8,
) -> Tuple[List[str], Optional[BeautifulSoup], str, int]:
    try:
        res = sesion.get(url, timeout=timeout, verify=False, allow_redirects=True)
        html = res.text or ""
        emails = extraer_emails_de_html(html)
        sopa = BeautifulSoup(html, "html.parser")

        for a in sopa.find_all("a", href=True):
            href = unquote(unescape((a.get("href") or "").strip()))
            if href.lower().startswith("mailto:"):
                emails.append(normalizar_email(href))

        return list(dict.fromkeys(emails)), sopa, res.url, res.status_code

    except Exception as e:
        log_si(logger, f"      [DEBUG] Error Requests en {url}: {str(e)[:100]}")
        return [], None, url, 0


def puntuar_enlace_contacto(texto: str, url: str, sector: Optional[str] = None) -> int:
    combo = normalizar_texto_simple(f"{texto} {url}")
    score = 0

    if any(p in combo for p in ["contacto", "contacta", "contactar", "contact", "contactenos"]):
        score += 1000
    if any(p in combo for p in ["atencion", "informacion", "ayuda", "help"]):
        score += 650
    if any(p in combo for p in ["directorio", "oficinas", "delegaciones", "sedes", "ubicacion", "telefono"]):
        score += 500
    if any(p in combo for p in ["quienes somos", "quienes-somos", "sobre nosotros", "sobre-nosotros", "equipo", "centro"]):
        score += 350
    if any(p in combo for p in ["administracion", "secretaria", "recepcion"]):
        score += 450
    if any(p in combo for p in ["reservas", "reserva", "booking", "ventas", "comercial", "citas"]):
        score += 450
    if any(p in combo for p in ["ciudadano", "ciudadana", "buzon", "oac", "registro"]):
        score += 550
    if "sede" in combo:
        score += 120
    if "ayuntamiento" in combo or "municipal" in combo:
        score += 70
    if any(p in combo for p in ["aviso legal", "aviso-legal", "legal"]):
        score += 80

    basura = [
        "facebook.com/sharer", "twitter.com/share", "x.com/share",
        "linkedin.com/share", "whatsapp://", "wa.me/", "/noticia/",
        "/noticias/", "/news/", "/blog/", "/actualidad/", "/agenda/",
        "/evento/", "/eventos/", "/rss", "/tag/", "/categoria/",
        "/category/", "/archivo/", "/page/", "/wp-content/", "youtube.com",
        "instagram.com", "facebook.com", "twitter.com", "x.com", "tiktok.com",
    ]
    if any(p in combo for p in basura):
        score -= 2000

    return score


def rutas_probables_genericas(sector: Optional[str] = None) -> List[str]:
    rutas = [
        "/contacto", "/contacta", "/contact", "/contactar", "/contactenos",
        "/atencion-al-cliente", "/atencion-cliente", "/atencion-a-la-ciudadania",
        "/web/atencion-a-la-ciudadania", "/informacion", "/directorio",
        "/oficinas", "/quienes-somos", "/sobre-nosotros", "/equipo",
        "/aviso-legal",
    ]

    sector_l = normalizar_texto_simple(sector or "")

    if any(x in sector_l for x in ["ayuntamiento", "municipal", "administracion"]):
        rutas.extend([
            "/buzon", "/buzon-ciudadano", "/servicios-ciudadano/buzon-ciudadano",
            "/registro", "/oac", "/sede", "/ayuntamiento", "/municipio",
        ])

    if any(x in sector_l for x in ["coleg", "escuela", "instituto", "academia"]):
        rutas.extend(["/secretaria", "/administracion", "/direccion", "/admisiones"])

    if any(x in sector_l for x in ["hotel", "restaurante", "bar", "cafeter"]):
        rutas.extend(["/reservas", "/booking", "/recepcion"])

    if any(x in sector_l for x in ["clinica", "salud", "dentista", "fisio", "veterin"]):
        rutas.extend(["/citas", "/recepcion"])

    return list(dict.fromkeys(rutas))


def descubrir_enlaces_candidatos(
    sopa: Optional[BeautifulSoup],
    url_base: str,
    sector: Optional[str] = None,
    max_reales: int = 12,
    max_probables: int = 6,
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
# Google Maps URL helpers
# ---------------------------------------------------------------------------

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


def extraer_nombre_desde_url_maps(url: str) -> Optional[str]:
    try:
        match = re.search(r"/maps/place/([^/@?]+)", url or "")
        if not match:
            return None
        nombre = unquote(match.group(1)).replace("+", " ").strip()
        return valor_util(nombre)
    except Exception:
        return None


def limpiar_url_maps(url: str) -> str:
    """Normaliza una URL de Maps para deduplicar mejor."""
    url = (url or "").strip()
    if not url:
        return ""

    url = url.split("&")[0]
    url = url.split("?")[0] if "/maps/place/" in url else url.split("&")[0]
    url, _ = urldefrag(url)
    return url


def es_url_google_maps(url: Optional[str]) -> bool:
    if not url:
        return False

    url_limpia = url.strip().lower()
    return (
        ("google." in url_limpia and "/maps" in url_limpia)
        or "maps.app.goo.gl" in url_limpia
        or "goo.gl/maps" in url_limpia
    )


# ---------------------------------------------------------------------------
# Ciudad / dirección
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Expansión de búsquedas por provincias/ayuntamientos
# ---------------------------------------------------------------------------

# Puntos geográficos aproximados para repartir búsquedas por provincia.
# No pretenden ser un censo oficial: sirven para que Maps no se quede en la capital.
PUNTOS_BUSQUEDA_PROVINCIA: Dict[str, List[str]] = {
    "palencia": [
        "Palencia", "Aguilar de Campoo", "Cervera de Pisuerga", "Guardo",
        "Saldaña", "Carrión de los Condes", "Herrera de Pisuerga", "Dueñas",
        "Venta de Baños", "Baltanás", "Villamuriel de Cerrato", "Astudillo",
        "Paredes de Nava", "Osorno la Mayor", "Alar del Rey", "Torquemada",
    ],
    "cantabria": [
        "Santander", "Torrelavega", "Castro-Urdiales", "Laredo", "Santoña",
        "Reinosa", "Potes", "Cabezón de la Sal", "San Vicente de la Barquera",
        "Selaya", "Los Corrales de Buelna", "Noja", "Suances", "Comillas",
    ],
    "leon": [
        "León", "Ponferrada", "Astorga", "La Bañeza", "Sahagún", "Cistierna",
        "Valencia de Don Juan", "Villablino", "Bembibre", "Fabero", "La Robla",
        "Boñar", "Mansilla de las Mulas", "Santa María del Páramo",
    ],
    "valladolid": ["Valladolid", "Medina del Campo", "Tordesillas", "Íscar", "Tudela de Duero", "Peñafiel", "Olmedo", "Medina de Rioseco", "Laguna de Duero"],
    "burgos": ["Burgos", "Miranda de Ebro", "Aranda de Duero", "Briviesca", "Lerma", "Medina de Pomar", "Villarcayo", "Salas de los Infantes", "Belorado"],
    "zamora": ["Zamora", "Benavente", "Toro", "Puebla de Sanabria", "Alcañices", "Fermoselle", "Villalpando", "Fuentesaúco"],
    "salamanca": ["Salamanca", "Béjar", "Ciudad Rodrigo", "Peñaranda de Bracamonte", "Vitigudino", "Alba de Tormes", "Guijuelo", "Ledesma"],
    "segovia": ["Segovia", "Cuéllar", "El Espinar", "Sepúlveda", "Riaza", "Cantalejo", "Carbonero el Mayor", "Nava de la Asunción"],
    "soria": ["Soria", "Almazán", "El Burgo de Osma", "Ólvega", "San Esteban de Gormaz", "Ágreda", "Medinaceli"],
    "madrid": ["Madrid", "Alcalá de Henares", "Móstoles", "Fuenlabrada", "Getafe", "Leganés", "Collado Villalba", "Aranjuez", "San Lorenzo de El Escorial"],
    "barcelona": ["Barcelona", "Badalona", "Hospitalet de Llobregat", "Terrassa", "Sabadell", "Mataró", "Manresa", "Vic", "Vilafranca del Penedès"],
    "valencia": ["Valencia", "Gandia", "Torrent", "Sagunto", "Xàtiva", "Requena", "Ontinyent", "Alzira", "Llíria"],
    "alicante": ["Alicante", "Elche", "Benidorm", "Alcoy", "Elda", "Dénia", "Orihuela", "Torrevieja", "Villena"],
    "murcia": ["Murcia", "Cartagena", "Lorca", "Molina de Segura", "Yecla", "Jumilla", "Caravaca de la Cruz", "Águilas", "Cieza"],
    "asturias": ["Oviedo", "Gijón", "Avilés", "Langreo", "Mieres", "Llanes", "Cangas de Onís", "Luarca", "Tineo"],
    "la coruna": ["A Coruña", "Santiago de Compostela", "Ferrol", "Carballo", "Ribeira", "Noia", "Betanzos", "Ortigueira"],
    "pontevedra": ["Pontevedra", "Vigo", "Vilagarcía de Arousa", "Tui", "Lalín", "A Estrada", "Cambados", "O Grove"],
    "ourense": ["Ourense", "Verín", "O Barco de Valdeorras", "Xinzo de Limia", "Ribadavia", "Celanova", "Allariz"],
    "lugo": ["Lugo", "Monforte de Lemos", "Viveiro", "Sarria", "Vilalba", "Ribadeo", "Chantada", "Foz"],
    "navarra": ["Pamplona", "Tudela", "Estella-Lizarra", "Tafalla", "Sangüesa", "Alsasua", "Elizondo", "Lodosa"],
    "la rioja": ["Logroño", "Calahorra", "Arnedo", "Haro", "Nájera", "Santo Domingo de la Calzada", "Alfaro"],
    "huesca": ["Huesca", "Barbastro", "Monzón", "Jaca", "Fraga", "Sabiñánigo", "Binéfar", "Graus"],
    "zaragoza": ["Zaragoza", "Calatayud", "Ejea de los Caballeros", "Tarazona", "Caspe", "La Almunia de Doña Godina", "Borja"],
    "teruel": ["Teruel", "Alcañiz", "Calamocha", "Andorra", "Utrillas", "Mora de Rubielos", "Valderrobres"],
}

PROVINCIA_ALIASES = {
    "león": "leon", "a coruña": "la coruna", "coruña": "la coruna",
    "orense": "ourense", "álava": "alava", "araba": "alava",
    "guipuzcoa": "gipuzkoa", "vizcaya": "bizkaia", "castellón": "castellon",
    "cáceres": "caceres", "cádiz": "cadiz", "córdoba": "cordoba",
    "málaga": "malaga", "jaén": "jaen", "almería": "almeria",
    "ávila": "avila", "lleida": "lleida", "lérida": "lleida", "lerida": "lleida",
}


def normalizar_lugar_key(lugar: str) -> str:
    key = normalizar_texto_simple(lugar)
    key = key.replace("provincia de ", "").replace("provincia ", "")
    key = key.replace("comunidad de ", "").strip()
    return PROVINCIA_ALIASES.get(key, key)


def es_sector_ayuntamiento(sector: str) -> bool:
    sector_l = normalizar_texto_simple(sector)
    return any(x in sector_l for x in ["ayuntamiento", "ayuntamientos", "municipal", "municipio"])


def cargar_municipios_desde_json(path: Optional[str] = None) -> Dict[str, List[str]]:
    """
    Carga un JSON opcional con municipios oficiales.

    Formato recomendado:
    {
      "palencia": ["Abarca de Campos", "Abia de las Torres", ...],
      "leon": [...]
    }

    Rutas buscadas por defecto:
    - backend/data/municipios_es.json
    - data/municipios_es.json
    """
    rutas: List[Path] = []

    if path:
        rutas.append(Path(path))

    here = Path(__file__).resolve().parent
    rutas.append(here / "data" / "municipios_es.json")
    rutas.append(Path.cwd() / "data" / "municipios_es.json")

    for ruta in rutas:
        try:
            if not ruta.exists():
                continue
            with ruta.open("r", encoding="utf-8") as fh:
                data = json.load(fh)

            salida: Dict[str, List[str]] = {}
            for prov, municipios in data.items():
                key = normalizar_lugar_key(prov)
                if isinstance(municipios, list):
                    salida[key] = [str(m).strip() for m in municipios if str(m).strip()]
            return salida
        except Exception:
            continue

    return {}


def limpiar_lugar_para_busqueda(lugar: str) -> str:
    """
    Devuelve el nombre que debe aparecer en la búsqueda de Maps.

    Ejemplos:
    - "provincia de Cantabria" -> "Cantabria"
    - "Provincia Palencia" -> "Palencia"
    - "comunidad de Castilla y León" -> "Castilla y León"

    La idea es que la primera búsqueda sea siempre natural:
    "{sector} en Cantabria", no "{sector} en provincia de Cantabria".
    """
    lugar = (lugar or "").strip()
    if not lugar:
        return ""

    lugar = re.sub(r"^\s*provincia\s+de\s+", "", lugar, flags=re.I).strip()
    lugar = re.sub(r"^\s*provincia\s+", "", lugar, flags=re.I).strip()
    lugar = re.sub(r"^\s*comunidad\s+de\s+", "", lugar, flags=re.I).strip()
    lugar = re.sub(r"\s+", " ", lugar).strip(" ,")
    return lugar


def es_lugar_provincia_conocida(lugar: str) -> bool:
    key = normalizar_lugar_key(lugar)
    return key in PUNTOS_BUSQUEDA_PROVINCIA or key in PROVINCIAS_O_TERRITORIOS


def generar_busquedas_maps(
    palabra: str,
    lugar: str,
    modo_prueba: bool = False,
    estrategia_ayuntamientos: str = "zonas",
    max_busquedas_por_lugar: int = 60,
    municipios_por_provincia: Optional[Dict[str, List[str]]] = None,
) -> List[str]:
    """
    Expande una palabra+ubicación en búsquedas reales de Maps.

    Regla importante:
    - La PRIMERA búsqueda siempre es la más natural:
      "{palabra} en {lugar_limpio}".
      Ejemplo: "Restaurante en Cantabria", "Ayuntamiento en Palencia".

    Después, solo si merece la pena, añade búsquedas complementarias:
    - Para ayuntamientos: zonas/municipios para cubrir mejor la provincia.
    - Para otros sectores: algunas búsquedas por puntos de la provincia, pero sin
      usar "provincia de..." y con límite bajo para que no se dispare el tiempo.
    """
    palabra = (palabra or "").strip()
    lugar_original = (lugar or "").strip()
    lugar_limpio = limpiar_lugar_para_busqueda(lugar_original)

    if not palabra or not lugar_limpio:
        return []

    lugar_key = normalizar_lugar_key(lugar_limpio)
    estrategia = normalizar_texto_simple(estrategia_ayuntamientos or "zonas")
    es_ayto = es_sector_ayuntamiento(palabra)

    busquedas: List[str] = []

    # 1) SIEMPRE primero la búsqueda simple, sirve para todos los sectores.
    busquedas.append(f"{palabra} en {lugar_limpio}")

    puntos = PUNTOS_BUSQUEDA_PROVINCIA.get(lugar_key, [])
    municipios_por_provincia = municipios_por_provincia or cargar_municipios_desde_json()
    municipios = municipios_por_provincia.get(lugar_key, [])

    if es_ayto:
        # 2) Complementarias sin "provincia de" como primera opción.
        busquedas.extend([
            f"Ayuntamientos {lugar_limpio}",
            f"Casa consistorial {lugar_limpio}",
        ])

        # 3) Si hay censo de municipios, permite búsqueda exacta municipio a municipio.
        if estrategia in {"municipios", "municipio", "mixta", "mixto", "auto"} and municipios:
            limite = 5 if modo_prueba else max_busquedas_por_lugar
            for municipio in municipios[:limite]:
                busquedas.append(f"Ayuntamiento de {municipio}, {lugar_limpio}")

        # 4) Si no es estrategia exclusivamente municipio, usa puntos repartidos.
        if estrategia not in {"municipios", "municipio"} and puntos:
            limite_puntos = 4 if modo_prueba else min(len(puntos), max_busquedas_por_lugar)
            for punto in puntos[:limite_puntos]:
                busquedas.append(f"Ayuntamiento cerca de {punto}, {lugar_limpio}")

        # 5) Fallback solo si no conocemos puntos ni municipios.
        if not puntos and not municipios:
            busquedas.extend([
                f"Ayuntamiento cerca de {lugar_limpio}",
                f"Ayuntamientos cerca de {lugar_limpio}",
            ])

    else:
        # Sectores genéricos: también puede interesar cubrir una provincia,
        # pero con pocas búsquedas para no tardar muchísimo.
        # Ejemplo: "clínicas en Cantabria" primero, luego "clínicas cerca de Santander, Cantabria".
        if puntos:
            limite_generico = 3 if modo_prueba else min(len(puntos), 8, max_busquedas_por_lugar)
            for punto in puntos[:limite_generico]:
                busquedas.append(f"{palabra} cerca de {punto}, {lugar_limpio}")

    dedup = list(dict.fromkeys(b.strip() for b in busquedas if b.strip()))

    if modo_prueba:
        return dedup[:8]

    return dedup[:max(1, max_busquedas_por_lugar)]


def generar_tareas_scraping(
    palabras: List[str],
    lugares: List[str],
    modo_prueba: bool = False,
    estrategia_ayuntamientos: str = "zonas",
    max_busquedas_por_lugar: int = 60,
) -> List[Dict[str, str]]:
    tareas: List[Dict[str, str]] = []
    vistos = set()
    municipios_por_provincia = cargar_municipios_desde_json()

    for palabra in palabras:
        for lugar in lugares:
            lugar_limpio = limpiar_lugar_para_busqueda(lugar)
            busquedas = generar_busquedas_maps(
                palabra,
                lugar_limpio,
                modo_prueba=modo_prueba,
                estrategia_ayuntamientos=estrategia_ayuntamientos,
                max_busquedas_por_lugar=max_busquedas_por_lugar,
                municipios_por_provincia=municipios_por_provincia,
            )

            for busqueda in busquedas:
                key = normalizar_texto_simple(busqueda)
                if key in vistos:
                    continue
                vistos.add(key)

                tareas.append({
                    "busqueda": busqueda,
                    "sector_automatico": palabra.strip().capitalize(),
                    "ubicacion_original": lugar_limpio,
                })

    return tareas

import os
from pathlib import Path
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication
from email.utils import formatdate, make_msgid
from email.header import Header
from html import unescape
import re
from typing import Any, Mapping

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETA_ADJUNTOS = os.path.join(BASE_DIR, "adjuntos_genericos")


def normalizar_smtp_config(smtp_config: Any | None = None) -> dict:
    """Normaliza la configuración SMTP recibida desde la configuración local."""
    if smtp_config is None:
        return {
            "host": "", "port": 0, "security": "ssl",
            "username": "", "password": "", "from_email": "",
            "from_name": None, "reply_to": None, "signature_html": None,
        }

    if isinstance(smtp_config, Mapping):
        getter = smtp_config.get
    else:
        getter = lambda key, default=None: getattr(smtp_config, key, default)

    port = int(getter("port") or getter("smtp_port") or 465)
    username = getter("username") or getter("smtp_username") or ""
    return {
        "host": getter("host") or getter("smtp_host") or "",
        "port": port,
        "security": (getter("security") or getter("smtp_security") or ("ssl" if port == 465 else "starttls")).lower(),
        "username": username,
        "password": getter("password") or getter("smtp_password") or "",
        "from_email": getter("from_email") or username,
        "from_name": getter("from_name"),
        "reply_to": getter("reply_to"),
        "signature_html": getter("signature_html"),
    }


def html_a_texto(html: str) -> str:
    """
    Fallback de texto plano para mejorar entregabilidad.
    """
    if not html:
        return ""

    texto = re.sub(r"<\s*br\s*/?>", "\n", html, flags=re.I)
    texto = re.sub(r"</p\s*>", "\n\n", texto, flags=re.I)
    texto = re.sub(r"<[^>]+>", "", texto)
    texto = unescape(texto)

    return re.sub(r"\n{3,}", "\n\n", texto).strip()


def construir_firma_html(nombre_remitente: str, firma_html: str | None = None) -> str:
    if firma_html is not None:
        return firma_html.replace("{{nombre_remitente}}", nombre_remitente)
    return f"""
    <br>
    <p>
        Agradeciéndoles de antemano su atención.<br>
        Quedo a su entera disposición para cualquier duda.<br>
        Un cordial saludo,
    </p>
    <p>
        <b>{nombre_remitente}</b><br>
        Grupo Publicitario Cruzial
    </p>
    <img src="cid:firmaLogo" style="width: 200px; margin-top: 10px; margin-bottom: 10px;" alt="Logo Cruzial">
    <p style="font-size: 11px; color: #777777;">
        <b>GRUPO PUBLICITARIO CRUZIAL, S.L.</b> CIF: B-39.378.146.<br>
        Bº La Yesera, 51 - nave 1. 39.612 Parbayón CANTABRIA<br>
        Tlfs: 942 03 34 04. email: admin@cruzialpublicidad.com
    </p>
    """


def adjuntar_archivo(msg: MIMEMultipart, ruta_archivo: str | Path, nombre_adjunto: str | None = None):
    ruta = Path(ruta_archivo)

    if not ruta.exists() or not ruta.is_file():
        print(f"[WARN] Adjunto no encontrado: {ruta}")
        return False

    nombre_final = nombre_adjunto or ruta.name

    try:
        with ruta.open("rb") as f:
            part = MIMEApplication(f.read(), Name=nombre_final)

        part.add_header("Content-Disposition", "attachment", filename=nombre_final)
        msg.attach(part)
        return True

    except Exception as e:
        print(f"[WARN] Error adjuntando archivo {ruta}: {e}")
        return False


def enviar_correo(
    destinatario: str,
    asunto: str,
    cuerpo_html_base: str,
    nombre_remitente: str,
    nombres_adjuntos: list | None = None,
    rutas_adjuntos: list | None = None,
    smtp_config: Any | None = None,
):
    """
    Envía un correo HTML con firma corporativa, logo inline y adjuntos opcionales.

    nombres_adjuntos:
        Lista de nombres dentro de /adjuntos_genericos.

    rutas_adjuntos:
        Lista de rutas absolutas o Path. Sirve para adjuntos subidos por el usuario
        o para archivos resueltos desde otra carpeta.

    La configuración SMTP se recibe ya validada desde la pantalla Configuración.
    """
    config = normalizar_smtp_config(smtp_config)
    if not config.get("host") or not config.get("username") or not config.get("password"):
        return False, "SMTP no configurado. Revisa Configuración → Email y SMTP."

    smtp_host = config["host"]
    smtp_port = int(config["port"])
    smtp_security = (config.get("security") or "ssl").lower()
    smtp_username = config["username"]
    from_email = config.get("from_email") or smtp_username
    reply_to = config.get("reply_to")

    firma_html = construir_firma_html(nombre_remitente, config.get("signature_html"))

    cuerpo_html_final = f"""
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333333; line-height: 1.6; max-width: 640px;">
        {cuerpo_html_base}
        {firma_html}
    </div>
    """

    msg = MIMEMultipart("mixed")
    msg["Subject"] = asunto
    nombre_header = Header(nombre_remitente, "utf-8").encode()
    msg["From"] = f"{nombre_header} <{from_email}>"
    if reply_to:
        msg["Reply-To"] = reply_to
    msg["To"] = destinatario
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=(from_email.split("@")[-1] if "@" in from_email else "cruzialpublicidad.com"))

    # alternative dentro de related: texto + HTML + logo inline
    msg_related = MIMEMultipart("related")
    msg.attach(msg_related)

    msg_alternative = MIMEMultipart("alternative")
    msg_related.attach(msg_alternative)

    parte_texto = MIMEText(html_a_texto(cuerpo_html_final), "plain", "utf-8")
    parte_html = MIMEText(cuerpo_html_final, "html", "utf-8")

    msg_alternative.attach(parte_texto)
    msg_alternative.attach(parte_html)

    ruta_logo = os.path.join(CARPETA_ADJUNTOS, "logo_cruzial.jpeg")
    if os.path.exists(ruta_logo):
        try:
            with open(ruta_logo, "rb") as f:
                logo = MIMEImage(f.read())

            logo.add_header("Content-ID", "<firmaLogo>")
            logo.add_header(
                "Content-Disposition",
                "inline",
                filename="logo_cruzial.jpeg",
            )
            msg_related.attach(logo)
        except Exception as e:
            print(f"[WARN] Error cargando logo: {e}")

    # Compatibilidad con lo que ya tenías: nombres dentro de /adjuntos_genericos.
    if nombres_adjuntos:
        for nombre in nombres_adjuntos:
            nombre_seguro = Path(str(nombre)).name
            ruta = os.path.join(CARPETA_ADJUNTOS, nombre_seguro)
            adjuntar_archivo(msg, ruta, nombre_seguro)

    # Nuevo: adjuntos por ruta absoluta/Path.
    if rutas_adjuntos:
        for ruta in rutas_adjuntos:
            adjuntar_archivo(msg, ruta)

    try:
        if smtp_security == "starttls" or smtp_port == 587:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                server.set_debuglevel(0)
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_username, config["password"])
                server.send_message(msg)
        else:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
                server.set_debuglevel(0)
                server.login(smtp_username, config["password"])
                server.send_message(msg)

        return True, "Enviado con éxito"

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Error SMTP: {error_msg}")
        return False, error_msg

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.repositories import local_settings_repository as repo
from backend.schemas.configuracion import AiPromptResponse, EmailSignatureResponse

AI_PROMPT_KEY = "campanas_ai_context_prompt"

DEFAULT_AI_CONTEXT_PROMPT = """Estamos preparando un correo para una campaña de email de Cruzial. Ayúdame a redactar, revisar o mejorar el asunto y el cuerpo del mensaje con un tono profesional, claro y natural.

Las variables de personalización deben escribirse exactamente con doble llave, por ejemplo {{nombre}}. Usa únicamente las variables que Cruzial indique como disponibles; no inventes tags nuevos. Si una variable puede estar vacía, redacta el texto de forma que el correo siga teniendo sentido.

Cuando propongas una versión final, entrega por separado el ASUNTO y el CUERPO. Si usas HTML, devuelve HTML puro y sencillo compatible con email, sin bloques Markdown ```html```, sin escapar < > y sin barras invertidas delante de etiquetas, dos puntos o arrobas. No cambies ni traduzcas los nombres de los tags."""


def get_ai_prompt(db: Session) -> AiPromptResponse:
    saved = repo.get_value(db, AI_PROMPT_KEY)
    return AiPromptResponse(
        prompt=saved if saved is not None else DEFAULT_AI_CONTEXT_PROMPT,
        is_default=saved is None,
    )


def save_ai_prompt(prompt: str, db: Session) -> AiPromptResponse:
    clean = prompt.strip()
    if not clean:
        raise HTTPException(status_code=422, detail="El prompt no puede estar vacío.")
    repo.set_value(db, AI_PROMPT_KEY, clean)
    db.commit()
    return AiPromptResponse(prompt=clean, is_default=False)


def reset_ai_prompt(db: Session) -> AiPromptResponse:
    repo.delete_value(db, AI_PROMPT_KEY)
    db.commit()
    return AiPromptResponse(prompt=DEFAULT_AI_CONTEXT_PROMPT, is_default=True)


EMAIL_SIGNATURE_KEY = "email_signature_html"

DEFAULT_EMAIL_SIGNATURE_HTML = """<br>
<p>
    Agradeciéndoles de antemano su atención.<br>
    Quedo a su entera disposición para cualquier duda.<br>
    Un cordial saludo,
</p>
<p>
    <b>{{nombre_remitente}}</b><br>
    Grupo Publicitario Cruzial
</p>
<img src="cid:firmaLogo" style="width: 200px; margin-top: 10px; margin-bottom: 10px;" alt="Logo Cruzial">
<p style="font-size: 11px; color: #777777;">
    <b>GRUPO PUBLICITARIO CRUZIAL, S.L.</b> CIF: B-39.378.146.<br>
    Bº La Yesera, 51 - nave 1. 39.612 Parbayón CANTABRIA<br>
    Tlfs: 942 03 34 04. email: admin@cruzialpublicidad.com
</p>"""


def get_email_signature(db: Session) -> EmailSignatureResponse:
    saved = repo.get_value(db, EMAIL_SIGNATURE_KEY)
    return EmailSignatureResponse(
        signature_html=saved if saved is not None else DEFAULT_EMAIL_SIGNATURE_HTML,
        is_default=saved is None,
    )


def get_email_signature_html(db: Session) -> str:
    return get_email_signature(db).signature_html


def save_email_signature(signature_html: str, db: Session) -> EmailSignatureResponse:
    clean = signature_html.strip()
    repo.set_value(db, EMAIL_SIGNATURE_KEY, clean)
    db.commit()
    return EmailSignatureResponse(signature_html=clean, is_default=False)


def reset_email_signature(db: Session) -> EmailSignatureResponse:
    repo.delete_value(db, EMAIL_SIGNATURE_KEY)
    db.commit()
    return EmailSignatureResponse(signature_html=DEFAULT_EMAIL_SIGNATURE_HTML, is_default=True)

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.repositories import local_settings_repository as repo
from backend.schemas.configuracion import AiPromptResponse

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

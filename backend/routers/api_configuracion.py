from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config import DB_PATH, LOG_DIR
from backend.dependencies import get_db
from backend.schemas.configuracion import AiPromptPayload, AiPromptResponse, LocalStatusResponse
from backend.schemas.organizacion_smtp import SmtpConfigPayload, SmtpConfigStatusResponse, SmtpTestResponse
from backend.services import local_settings_service
from backend.services import organizacion_smtp_service as smtp_service

router = APIRouter(prefix="/configuracion", tags=["Configuración local"])


@router.get("/estado", response_model=LocalStatusResponse)
def get_local_status(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
        message = "Base de datos accesible."
    except Exception:
        db_ok = False
        message = "No se pudo acceder a la base de datos. Revisa la ruta/permisos de red."
    return LocalStatusResponse(
        database_path=DB_PATH,
        database_ok=db_ok,
        database_message=message,
        log_path=str(LOG_DIR),
    )


@router.get("/prompt-ia", response_model=AiPromptResponse)
def get_ai_prompt(db: Session = Depends(get_db)):
    return local_settings_service.get_ai_prompt(db)


@router.put("/prompt-ia", response_model=AiPromptResponse)
def save_ai_prompt(payload: AiPromptPayload, db: Session = Depends(get_db)):
    return local_settings_service.save_ai_prompt(payload.prompt, db)


@router.delete("/prompt-ia", response_model=AiPromptResponse)
def reset_ai_prompt(db: Session = Depends(get_db)):
    return local_settings_service.reset_ai_prompt(db)


@router.get("/smtp", response_model=SmtpConfigStatusResponse)
def get_smtp_status(db: Session = Depends(get_db)):
    return smtp_service.get_status(db)


@router.post("/smtp/probar", response_model=SmtpTestResponse)
def test_smtp(payload: SmtpConfigPayload):
    return smtp_service.test_config(payload)


@router.put("/smtp", response_model=SmtpConfigStatusResponse)
def save_smtp(payload: SmtpConfigPayload, db: Session = Depends(get_db)):
    return smtp_service.save_config(payload, db)


@router.delete("/smtp")
def delete_smtp(db: Session = Depends(get_db)):
    return smtp_service.delete_config(db)

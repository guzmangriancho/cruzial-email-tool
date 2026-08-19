from __future__ import annotations

from pydantic import BaseModel, Field


class LocalStatusResponse(BaseModel):
    database_path: str
    database_ok: bool
    database_message: str
    log_path: str
    app_mode: str = "local"


class AiPromptResponse(BaseModel):
    prompt: str
    is_default: bool = False


class AiPromptPayload(BaseModel):
    prompt: str = Field(min_length=1, max_length=20000)

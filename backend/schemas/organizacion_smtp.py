from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SmtpConfigStatusResponse(BaseModel):
    configured: bool
    source: str = "organization"
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_security: Optional[str] = None
    smtp_username: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    last_test_success: bool = False
    last_test_at: Optional[datetime] = None
    last_test_error: Optional[str] = None
    can_edit: bool = False


class SmtpConfigPayload(BaseModel):
    smtp_username: str = Field(..., min_length=3, max_length=255)
    smtp_password: Optional[str] = Field(None, max_length=1024)
    from_name: Optional[str] = Field(None, max_length=255)
    from_email: Optional[str] = Field(None, max_length=255)
    reply_to: Optional[str] = Field(None, max_length=255)
    smtp_host: Optional[str] = Field(None, max_length=255)
    smtp_port: Optional[int] = None
    smtp_security: Optional[str] = None
    auto_discover: bool = True


class SmtpTestResponse(BaseModel):
    ok: bool
    message: str
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_security: Optional[str] = None

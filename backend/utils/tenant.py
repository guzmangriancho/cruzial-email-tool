from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

DEFAULT_ORGANIZATION_ID = 1


def current_organization_id(db: Session) -> int:
    return int(db.info.get("organization_id") or DEFAULT_ORGANIZATION_ID)


def current_user_id(db: Session) -> Optional[int]:
    value = db.info.get("user_id")
    return int(value) if value else None


def set_tenant_fields(obj, db: Session, creating: bool = True):
    org_id = current_organization_id(db)
    user_id = current_user_id(db)
    if hasattr(obj, "organization_id") and not getattr(obj, "organization_id", None):
        obj.organization_id = org_id
    if creating and hasattr(obj, "created_by_user_id") and not getattr(obj, "created_by_user_id", None):
        obj.created_by_user_id = user_id
    if hasattr(obj, "updated_by_user_id"):
        obj.updated_by_user_id = user_id
    return obj

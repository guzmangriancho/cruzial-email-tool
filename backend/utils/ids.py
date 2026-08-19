from __future__ import annotations

import uuid


def generate_public_id() -> str:
    """Stable opaque identifier for resources exposed through the API.

    We keep numeric `id` as the internal primary key because it is simple and
    efficient for joins, and add this value for safer future external usage.
    """
    return uuid.uuid4().hex


def is_public_id(value: str | None) -> bool:
    value = (value or "").strip()
    return len(value) == 32 and all(ch in "0123456789abcdefABCDEF" for ch in value)

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

APP_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = APP_ROOT / ".env"
load_dotenv(ENV_PATH, override=False)


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on", "si", "sí"}


def resolve_db_path() -> str:
    raw = (os.getenv("CRUZIAL_DB_PATH") or "data/cruzial_crm.db").strip()
    raw = os.path.expandvars(os.path.expanduser(raw))

    # En Windows respetamos rutas absolutas, unidades mapeadas y UNC.
    is_windows_absolute = (
        len(raw) >= 3 and raw[1:3] in {":\\", ":/"}
    ) or raw.startswith("\\\\")

    if os.path.isabs(raw) or is_windows_absolute:
        return os.path.normpath(raw)

    # Las rutas relativas del ejemplo usan /, que funciona tanto en Windows como
    # en Linux/macOS. Si alguien escribe \ en una ruta relativa, la normalizamos.
    relative = raw.replace("\\", os.sep)
    return os.path.normpath(str(APP_ROOT / relative))


DB_PATH = resolve_db_path()
_raw_log_dir = os.getenv("CRUZIAL_LOG_DIR") or "logs"
_log_path = Path(_raw_log_dir).expanduser()
LOG_DIR = _log_path if _log_path.is_absolute() else (APP_ROOT / _log_path)

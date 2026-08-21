from __future__ import annotations

import logging
import os
import sys
import time
import traceback
import uuid
from logging.handlers import RotatingFileHandler
from pathlib import Path
from types import ModuleType

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(ROOT_DIR)
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text

from backend import models
from backend.bootstrap import ensure_bootstrap_data
from backend.config import DB_PATH, LOG_DIR
from backend.database import SessionLocal, engine
from backend.routers import api_campanas, api_clientes, api_configuracion, api_scraper, api_segmentos


def configure_logging() -> logging.Logger:
    Path(LOG_DIR).mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("cruzial")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    if not logger.handlers:
        formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
        file_handler = RotatingFileHandler(
            Path(LOG_DIR) / "cruzial.log",
            maxBytes=5 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        console = logging.StreamHandler()
        console.setFormatter(formatter)
        logger.addHandler(console)
    return logger


logger = configure_logging()

# Crea solo las tablas necesarias si se usa una BBDD nueva. En la BBDD histórica
# no elimina ni modifica las tablas antiguas de usuarios/IA/etc. Dejamos trazas
# explícitas porque una BBDD en SMB puede tardar en obtener un bloqueo inicial.
logger.info("startup fase=database_init estado=iniciando path=%s", DB_PATH)
try:
    models.Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_bootstrap_data(db)
        db.execute(text("SELECT 1"))
    logger.info("startup fase=database_init estado=ok")
except Exception:
    logger.exception("startup fase=database_init estado=error path=%s", DB_PATH)
    raise

app = FastAPI(
    title="Cruzial Local",
    description="Herramientas locales de captación, clientes, segmentos y campañas.",
    version="1.4.2-local",
)

cors_origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    request_id = uuid.uuid4().hex[:10]
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.exception(
            "request_id=%s method=%s path=%s status=500 elapsed_ms=%s",
            request_id,
            request.method,
            request.url.path,
            elapsed_ms,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno. Revisa logs/cruzial.log.", "request_id": request_id},
        )

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "request_id=%s method=%s path=%s status=%s elapsed_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    response.headers["X-Request-Id"] = request_id
    return response


app.include_router(api_scraper.router, prefix="/api")
app.include_router(api_clientes.router, prefix="/api")
app.include_router(api_segmentos.router, prefix="/api")
app.include_router(api_campanas.router, prefix="/api")
app.include_router(api_configuracion.router, prefix="/api")


FRONTEND_DIST = Path(APP_ROOT) / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"
API_PREFIXES = {"api", "health", "docs", "redoc", "openapi.json"}


@app.get("/health")
def health():
    # Este endpoint comprueba que el proceso HTTP está listo. La comprobación
    # detallada de SQLite está en /api/configuracion/estado. No abrimos otra
    # conexión aquí para que el lanzador no introduzca bloqueos extra en SMB.
    return {"ok": True}


@app.get("/", include_in_schema=False)
def frontend_root():
    if FRONTEND_INDEX.exists():
        return FileResponse(FRONTEND_INDEX, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})
    return {
        "app": "Cruzial Local",
        "modo": "local",
        "database": DB_PATH,
        "aviso": "Frontend no compilado. Ejecuta el instalador de tu sistema (Windows o macOS).",
    }


@app.get("/{full_path:path}", include_in_schema=False)
def frontend_spa(full_path: str):
    first = full_path.split("/", 1)[0]
    if first in API_PREFIXES:
        raise HTTPException(status_code=404, detail="Ruta no encontrada.")

    if not FRONTEND_INDEX.exists():
        raise HTTPException(status_code=503, detail="Frontend no compilado. Ejecuta el instalador de tu sistema (Windows o macOS).")

    # Sirve ficheros generados (assets/favicon) sin permitir salir de dist.
    candidate = (FRONTEND_DIST / full_path).resolve()
    dist_resolved = FRONTEND_DIST.resolve()
    try:
        candidate.relative_to(dist_resolved)
    except ValueError:
        raise HTTPException(status_code=404, detail="Ruta no válida.")

    if candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(FRONTEND_INDEX, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

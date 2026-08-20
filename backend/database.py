from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import DB_PATH


def _prepare_database_location() -> None:
    parent = os.path.dirname(DB_PATH)
    if not parent:
        return

    # En macOS los recursos SMB/AFP montados por Finder viven normalmente en
    # /Volumes/<nombre>. Si el volumen no está montado, abortamos en vez de
    # arriesgarnos a crear una BBDD local vacía en una ruta parecida.
    if sys.platform == "darwin":
        db_path = Path(DB_PATH)
        parts = db_path.parts
        if len(parts) >= 3 and parts[0] == "/" and parts[1] == "Volumes":
            volume_root = Path("/Volumes") / parts[2]
            if not volume_root.exists():
                raise RuntimeError(
                    f"El volumen de red no está montado: {volume_root}. "
                    "Móntalo desde Finder y revisa CRUZIAL_DB_PATH en .env."
                )

    try:
        os.makedirs(parent, exist_ok=True)
    except OSError as exc:
        raise RuntimeError(
            f"No se puede acceder a la carpeta de la base de datos: {parent}. "
            "Revisa CRUZIAL_DB_PATH en .env y los permisos de red."
        ) from exc


_prepare_database_location()

SQLITE_TIMEOUT_SECONDS = float(os.getenv("CRUZIAL_DB_TIMEOUT_SECONDS", "20"))


def _connect() -> sqlite3.Connection:
    return sqlite3.connect(
        DB_PATH,
        timeout=SQLITE_TIMEOUT_SECONDS,
        check_same_thread=False,
    )


# creator= permite utilizar de forma fiable rutas Windows/UNC sin depender de
# cómo SQLAlchemy interprete barras y unidades de red en una URL sqlite:///.
engine = create_engine(
    "sqlite+pysqlite://",
    creator=_connect,
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute(f"PRAGMA busy_timeout={int(SQLITE_TIMEOUT_SECONDS * 1000)}")
        cursor.execute("PRAGMA foreign_keys=ON")
        # No cambiamos journal_mode en cada conexión. SQLite usa DELETE por
        # defecto y forzarlo repetidamente puede necesitar un bloqueo exclusivo,
        # especialmente molesto en volúmenes SMB de macOS.
        cursor.execute("PRAGMA synchronous=FULL")
    finally:
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

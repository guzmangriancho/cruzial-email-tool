from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import DB_PATH


def _prepare_database_location() -> None:
    parent = os.path.dirname(DB_PATH)
    if not parent:
        return
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
        # DELETE es más compatible con carpetas de red que WAL.
        cursor.execute("PRAGMA journal_mode=DELETE")
        cursor.execute("PRAGMA synchronous=FULL")
    finally:
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

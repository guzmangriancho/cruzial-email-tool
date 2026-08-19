from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.utils.ids import generate_public_id


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), nullable=False, unique=True, index=True, default=generate_public_id)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    nombre = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_active = Column("activo", Boolean, nullable=False, default=True)
    is_verified = Column("verificado", Boolean, nullable=False, default=True)
    is_superadmin = Column("superadmin", Boolean, nullable=False, default=False)
    last_login_at = Column("ultimo_login_at", DateTime, nullable=True)
    created_at = Column("fecha_creacion", DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column("fecha_actualizacion", DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    memberships = relationship(
        "MiembroOrganizacion",
        foreign_keys="MiembroOrganizacion.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )

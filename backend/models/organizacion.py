from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.utils.ids import generate_public_id


class Organizacion(Base):
    __tablename__ = "organizaciones"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), nullable=False, unique=True, index=True, default=generate_public_id)
    nombre = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    tipo = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    estado = Column(String, nullable=False, default="active")
    owner_user_id = Column("propietario_usuario_id", Integer, ForeignKey("usuarios.id"), nullable=True)
    settings_json = Column("configuracion_json", Text, nullable=True)
    created_at = Column("fecha_creacion", DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column("fecha_actualizacion", DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    memberships = relationship(
        "MiembroOrganizacion",
        back_populates="organization",
        cascade="all, delete-orphan",
    )


class MiembroOrganizacion(Base):
    __tablename__ = "organizacion_miembros"
    __table_args__ = (
        UniqueConstraint("usuario_id", "organizacion_id", name="uq_organizacion_miembro_usuario"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column("usuario_id", Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    organization_id = Column("organizacion_id", Integer, ForeignKey("organizaciones.id"), nullable=False, index=True)
    role = Column("rol", String, nullable=False, default="member")
    status = Column("estado", String, nullable=False, default="active")
    invited_by_user_id = Column("invitado_por_usuario_id", Integer, ForeignKey("usuarios.id"), nullable=True)
    created_at = Column("fecha_creacion", DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column("fecha_actualizacion", DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("Usuario", foreign_keys=[user_id], back_populates="memberships")
    organization = relationship("Organizacion", back_populates="memberships")

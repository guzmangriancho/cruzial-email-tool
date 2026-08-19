from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.utils.ids import generate_public_id


class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), nullable=False, unique=True, index=True, default=generate_public_id)
    organization_id = Column(Integer, ForeignKey("organizaciones.id"), nullable=False, index=True, default=1)
    created_by_user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    nombre = Column(String, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)

    # Borrador, Preparada, En Progreso, Pausada, Completada, Error
    estado = Column(String, default="Borrador", index=True)

    plantilla_id = Column(Integer, ForeignKey("plantillas.id"))
    remitente = Column(String, nullable=True)
    delay_segundos = Column(Integer, default=30)
    total_destinatarios = Column(Integer, default=0)

    plantilla = relationship("Plantilla", back_populates="campanas")
    envios = relationship(
        "EnvioLog",
        back_populates="campana",
        cascade="all, delete-orphan",
    )

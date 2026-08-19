from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.utils.ids import generate_public_id


class Plantilla(Base):
    __tablename__ = "plantillas"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), nullable=False, unique=True, index=True, default=generate_public_id)
    organization_id = Column(Integer, ForeignKey("organizaciones.id"), nullable=False, index=True, default=1)
    created_by_user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    nombre_interno = Column(String, nullable=False)
    asunto = Column(String, nullable=False)
    cuerpo_html = Column(Text, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    campanas = relationship("Campana", back_populates="plantilla")

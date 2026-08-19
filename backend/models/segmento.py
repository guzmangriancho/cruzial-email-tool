from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from backend.database import Base
from backend.utils.ids import generate_public_id


class Segmento(Base):
    __tablename__ = "crm_segmentos"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), nullable=False, unique=True, index=True, default=generate_public_id)
    organization_id = Column(Integer, ForeignKey("organizaciones.id"), nullable=False, index=True, default=1)
    nombre = Column(String, nullable=False)
    descripcion = Column(Text, nullable=True)
    tipo = Column(String, nullable=False, default="dinamico")
    filtros_json = Column(Text, nullable=True)
    color = Column(String, nullable=True, default="blue")
    created_by_user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class SegmentoCliente(Base):
    __tablename__ = "crm_segmento_clientes"
    __table_args__ = (UniqueConstraint("organization_id", "segmento_id", "cliente_id", name="uq_segmento_cliente_org"),)

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizaciones.id"), nullable=False, index=True, default=1)
    segmento_id = Column(Integer, ForeignKey("crm_segmentos.id"), nullable=False, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False, index=True)
    fecha_agregado = Column(DateTime, nullable=False, default=datetime.utcnow)

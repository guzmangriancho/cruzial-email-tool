from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.utils.ids import generate_public_id


class Cliente(Base):
    __tablename__ = "clientes"
    __table_args__ = (
        Index("ix_clientes_org_email", "organization_id", "email"),
        Index("ix_clientes_org_url_maps", "organization_id", "url_maps"),
        Index("ix_clientes_org_sitio_web", "organization_id", "sitio_web"),
    )

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), nullable=False, unique=True, index=True, default=generate_public_id)
    organization_id = Column(Integer, ForeignKey("organizaciones.id"), nullable=False, index=True, default=1)
    created_by_user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    nombre = Column(String, index=True)
    email = Column(String, index=True, nullable=True)
    telefono = Column(String, nullable=True)
    sitio_web = Column(String, nullable=True)
    direccion = Column(String, nullable=True)
    ciudad = Column(String, nullable=True)
    latitud = Column(Float, nullable=True)
    longitud = Column(Float, nullable=True)
    url_maps = Column(String, nullable=True)
    valoracion = Column(Float, nullable=True)
    num_resenas = Column(Integer, nullable=True)
    categoria_google = Column(String, nullable=True)
    termino_busqueda = Column(String, nullable=True)
    sector = Column(String, nullable=True)
    prioridad = Column(Integer, default=3)
    fecha_captacion = Column(DateTime, default=datetime.utcnow)

    envios = relationship("EnvioLog", back_populates="cliente")

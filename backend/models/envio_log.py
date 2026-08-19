from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.database import Base


class EnvioLog(Base):
    __tablename__ = "envios_log"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizaciones.id"), nullable=False, index=True, default=1)
    campana_id = Column(Integer, ForeignKey("campanas.id"), index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), index=True)

    fecha_envio = Column(DateTime, nullable=True)

    # Pendiente, Enviando, Éxito, Error, Omitido
    estado = Column(String, nullable=False, default="Pendiente", index=True)
    detalle_error = Column(Text, nullable=True)
    intentos = Column(Integer, default=0)

    campana = relationship("Campana", back_populates="envios")
    cliente = relationship("Cliente", back_populates="envios")

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from backend.database import Base


class OrganizacionSmtpConfig(Base):
    __tablename__ = "organizacion_smtp_config"
    __table_args__ = (
        UniqueConstraint("organizacion_id", name="uq_organizacion_smtp_config_org"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column("organizacion_id", Integer, ForeignKey("organizaciones.id"), nullable=False, index=True)
    smtp_host = Column(String, nullable=False)
    smtp_port = Column(Integer, nullable=False, default=465)
    smtp_security = Column(String, nullable=False, default="ssl")  # ssl | starttls
    smtp_username = Column(String, nullable=False)
    smtp_password_encrypted = Column(Text, nullable=False)
    from_email = Column(String, nullable=False)
    from_name = Column(String, nullable=True)
    reply_to = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    last_test_success = Column(Boolean, nullable=False, default=False)
    last_test_at = Column(DateTime, nullable=True)
    last_test_error = Column(Text, nullable=True)
    last_test_host = Column(String, nullable=True)
    last_test_port = Column(Integer, nullable=True)
    last_test_security = Column(String, nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    created_at = Column("fecha_creacion", DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column("fecha_actualizacion", DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

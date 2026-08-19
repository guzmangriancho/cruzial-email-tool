"""Modelos necesarios para la edición local de Cruzial.

Las tablas de usuario/organización se cargan únicamente para mantener las claves
foráneas y la compatibilidad con la base histórica. No existe API de usuarios,
autenticación ni multiempresa en esta edición.
"""
from backend.database import Base
from backend.models.usuario import Usuario
from backend.models.organizacion import Organizacion, MiembroOrganizacion
from backend.models.cliente import Cliente
from backend.models.plantilla import Plantilla
from backend.models.campana import Campana
from backend.models.envio_log import EnvioLog
from backend.models.segmento import Segmento, SegmentoCliente
from backend.models.organizacion_smtp import OrganizacionSmtpConfig

User = Usuario
Organization = Organizacion
Membership = MiembroOrganizacion

__all__ = [
    "Base", "Usuario", "Organizacion", "MiembroOrganizacion",
    "User", "Organization", "Membership",
    "Cliente", "Plantilla", "Campana", "EnvioLog",
    "Segmento", "SegmentoCliente", "OrganizacionSmtpConfig",
]

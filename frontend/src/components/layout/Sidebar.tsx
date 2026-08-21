import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  ListChecks,
  Mail,
  MapPinned,
  Search,
  Settings,
} from "lucide-react";

import { configuracionService } from "../../services/configuracionService";
import { cx, ui } from "../ui";

type NavItem = { label: string; to: string; icon: ReactNode; description: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Buscar en Maps", to: "/buscar", icon: <Search size={18} />, description: "Captación por sector y zona" },
  { label: "Clientes", to: "/clientes", icon: <Database size={18} />, description: "Base de datos local" },
  { label: "Mapa", to: "/mapa", icon: <MapPinned size={18} />, description: "Visualización geográfica" },
  { label: "Segmentos", to: "/segmentos", icon: <ListChecks size={18} />, description: "Listas y filtros" },
  { label: "Campañas email", to: "/campanas", icon: <Mail size={18} />, description: "Envíos por SMTP" },
  { label: "Configuración", to: "/configuracion", icon: <Settings size={18} />, description: "Base de datos y correo" },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [configuredEmail, setConfiguredEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadConfiguredEmail = async () => {
      try {
        const smtp = await configuracionService.smtpEstado();
        if (active) {
          setConfiguredEmail(smtp.smtp_username || smtp.from_email || null);
        }
      } catch {
        if (active) setConfiguredEmail(null);
      }
    };

    const handleSmtpUpdated = () => {
      void loadConfiguredEmail();
    };

    void loadConfiguredEmail();
    window.addEventListener("cruzial:smtp-updated", handleSmtpUpdated);

    return () => {
      active = false;
      window.removeEventListener("cruzial:smtp-updated", handleSmtpUpdated);
    };
  }, []);

  return (
    <div className={ui.app.shell}>
      <aside className={cx(ui.app.sidebar, collapsed ? ui.app.sidebarCollapsed : ui.app.sidebarExpanded)}>
        <div className={cx(ui.app.sidebarHeader, collapsed && ui.app.sidebarHeaderCollapsed)}>
          {collapsed ? (
            <div className={ui.app.sidebarLogo}>
              <span className="text-sm font-semibold">C</span>
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className={ui.app.sidebarBrand}>Cruzial</h2>
              <p className={ui.app.sidebarDescription}>Gestión comercial</p>
            </div>
          )}
          <button
            type="button"
            className={cx(ui.nav.collapseButton, collapsed && ui.nav.collapseButtonCollapsed)}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        <nav className={cx(ui.app.sidebarNav, collapsed && ui.app.sidebarNavCollapsed)}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cx(
                  ui.nav.groupButton,
                  isActive ? ui.nav.groupActive : ui.nav.groupInactive,
                  collapsed && ui.nav.groupButtonCollapsed,
                )
              }
            >
              <span className={ui.nav.groupIcon}>{item.icon}</span>
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className={ui.nav.groupLabel}>{item.label}</span>
                  <span className={ui.nav.groupDescription}>{item.description}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={cx(ui.app.sidebarFooter, collapsed && ui.app.sidebarFooterCollapsed)}>
          {!collapsed ? (
            <div className="min-w-0">
              <span className={ui.app.sidebarFooterText}>Cruzial Local</span>
              <p className={ui.app.sidebarFooterSubtext} title={configuredEmail || "SMTP sin configurar"}>{configuredEmail || "SMTP sin configurar"}</p>
            </div>
          ) : (
            <Database size={17} />
          )}
        </div>
      </aside>

      <main className={ui.app.main}>
        <Outlet />
      </main>
    </div>
  );
}

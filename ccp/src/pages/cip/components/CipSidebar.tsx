import type { SeccionCip } from '../types';
import {
  IconBell,
  IconBox,
  IconCpu,
  IconFileText,
  IconHome,
  IconLayers,
  IconMapPin,
  IconRepeat,
  IconSettings,
  IconUsers,
  IconWrench,
} from '@/components/icons';

interface CipSidebarProps {
  seccionActiva: SeccionCip;
  onSeleccionarSeccion: (sec: SeccionCip) => void;
  organizacionId?: string;
}

const ITEMS_MENU: Array<{ id: SeccionCip; label: string; icon: React.ReactNode }> = [
  { id: 'resumen', label: 'Resumen', icon: <IconHome /> },
  { id: 'activos', label: 'Catálogo Activos (AFT)', icon: <IconBox /> },
  { id: 'inventarios', label: 'Inventarios', icon: <IconLayers /> },
  { id: 'mantenimientos', label: 'Mantenimientos', icon: <IconWrench /> },
  { id: 'traslados', label: 'Traslados', icon: <IconRepeat /> },
  { id: 'reportes', label: 'Reportes', icon: <IconFileText /> },
  { id: 'alertas', label: 'Alertas', icon: <IconBell /> },
];

const ITEMS_ESTRUCTURA: Array<{ id: SeccionCip; label: string; icon: React.ReactNode }> = [
  { id: 'ubicaciones', label: 'Ubicaciones', icon: <IconMapPin /> },
  { id: 'usuarios', label: 'Usuarios', icon: <IconUsers /> },
  { id: 'config', label: 'Configuración', icon: <IconSettings /> },
];

export function CipSidebar({
  seccionActiva,
  onSeleccionarSeccion,
  organizacionId,
}: CipSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-bg-raised lg:flex z-20">
      {/* Brand Header */}
      <div
        className="flex h-16 items-center gap-2.5 border-b border-border px-6"
        style={{ background: 'var(--brand-grad)' }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-bg shadow-sm">
          <IconCpu />
        </span>
        <div>
          <span className="text-sm font-bold tracking-[0.2em] text-text uppercase block leading-none">
            SICSAFT
          </span>
          <span className="text-[0.65rem] font-semibold text-accent-strong tracking-wider uppercase">
            CIP Analytics
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wide text-text-faint uppercase">
          Módulos de Consulta
        </p>

        {ITEMS_MENU.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSeleccionarSeccion(item.id)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              seccionActiva === item.id
                ? 'bg-accent/15 text-accent-strong font-semibold'
                : 'text-text-dim hover:bg-bg-card hover:text-text'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        <div className="my-3 border-t border-border" />
        <p className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wide text-text-faint uppercase">
          Estructura
        </p>

        {ITEMS_ESTRUCTURA.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSeleccionarSeccion(item.id)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              seccionActiva === item.id
                ? 'bg-accent/15 text-accent-strong font-semibold'
                : 'text-text-dim hover:bg-bg-card hover:text-text'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer enlace a CCP */}
      <div className="border-t border-border p-4 bg-bg-card/40">
        {organizacionId && (
          <a
            href={`/activos?organizacionId=${encodeURIComponent(organizacionId)}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg-raised py-2 text-xs font-semibold text-text-dim transition-colors hover:bg-bg-card hover:text-text"
          >
            <IconBox />
            <span>Abrir CCP Operativo</span>
          </a>
        )}
      </div>
    </aside>
  );
}

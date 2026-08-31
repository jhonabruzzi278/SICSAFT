import type { ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { moduloHabilitado } from '@/lib/nivel';
import { Button } from './ui';
import {
  IconBox,
  IconFileText,
  IconHome,
  IconLayers,
  IconLogOut,
  IconMapPin,
  IconQrCode,
  IconShield,
  IconUpload,
} from './icons';

// RF-02/DOC-013 — sidebar de navegación para el Profesional de AFT. Los links preservan
// organizacionId (la app es multi-organización, ver HubPage) para no perder el contexto al
// navegar entre módulos. Sin organizacionId en la URL (solo pasa en el hub "/") no hay contexto
// de organización todavía, así que el sidebar no se muestra — ahí el operador todavía está
// eligiendo con qué organización trabajar (con una sola organización, HubPage redirige directo
// a /dashboard y nunca se llega a ver ese estado, ver HubPage.tsx).
const NAV_ITEMS = [
  { path: 'activos', nombre: 'Activos', icon: IconBox },
  { path: 'contratos', nombre: 'Contratos', icon: IconFileText },
  { path: 'inventarios', nombre: 'Inventarios', icon: IconLayers },
  { path: 'estructura', nombre: 'Áreas y ubicaciones', icon: IconMapPin },
  { path: 'importaciones', nombre: 'Importaciones', icon: IconUpload },
  { path: 'etiquetas', nombre: 'QR / Etiquetas', icon: IconQrCode },
] as const;

function SideNavLink({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-accent/12 text-accent-strong before:absolute before:top-1.5 before:bottom-1.5 before:-left-3 before:w-1 before:rounded-r-full before:bg-accent'
          : 'text-text-dim hover:bg-bg-card hover:text-text'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function Sidebar({ organizacionId }: { organizacionId: string }) {
  const location = useLocation();
  const q = `?organizacionId=${encodeURIComponent(organizacionId)}`;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-bg-raised shadow-elev-2 lg:flex">
      <div
        className="flex h-16 items-center gap-2.5 border-b border-border px-6"
        style={{ background: 'var(--brand-grad)' }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-bg">
          S
        </span>
        <span className="text-sm font-bold tracking-[0.2em] text-text uppercase">
          SICSAFT
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wide text-text-faint uppercase">
          Patrimonio
        </p>
        <SideNavLink
          to={`/dashboard${q}`}
          active={location.pathname === '/dashboard'}
          icon={<IconHome />}
        >
          Resumen
        </SideNavLink>
        {/* DOC-029 RF-A -- en Nivel 1 solo se muestran los modulos de consulta/inventario/
            trazabilidad; Contratos y Estructura quedan fuera (ver lib/nivel.ts). */}
        {NAV_ITEMS.filter(({ path }) => moduloHabilitado(path)).map(
          ({ path, nombre, icon: Icon }) => (
            <SideNavLink
              key={path}
              to={`/${path}${q}`}
              active={location.pathname === `/${path}`}
              icon={<Icon />}
            >
              {nombre}
            </SideNavLink>
          ),
        )}
        {moduloHabilitado('auditoria') && (
          <>
            <div className="my-3 border-t border-border" />
            <SideNavLink
              to="/auditoria"
              active={location.pathname === '/auditoria'}
              icon={<IconShield />}
            >
              Auditoría
            </SideNavLink>
          </>
        )}
      </nav>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const authenticated = oidcClient.isAuthenticated();
  const nombre = oidcClient.getCurrentOperatorDisplayName();
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId');

  function cerrarSesion() {
    oidcClient.logout();
    window.location.assign('/');
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {authenticated && organizacionId && (
        <Sidebar organizacionId={organizacionId} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg-raised/95 px-6 shadow-elev-1 backdrop-blur">
          <Link
            to="/"
            className="text-sm font-bold tracking-[0.2em] text-accent-strong uppercase lg:hidden"
          >
            SICSAFT
          </Link>
          <span className="hidden text-sm font-medium text-text-dim lg:block">
            Centro de Control Patrimonial
          </span>
          {authenticated && (
            <div className="flex items-center gap-3 text-sm">
              {nombre && (
                <span className="flex items-center gap-2.5 text-text-dim">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-dim text-xs font-semibold text-accent-strong ring-1 ring-border-strong">
                    {nombre.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline">{nombre}</span>
                </span>
              )}
              <Button
                variant="secondary"
                onClick={cerrarSesion}
                className="gap-1.5"
              >
                <IconLogOut />
                Cerrar sesión
              </Button>
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

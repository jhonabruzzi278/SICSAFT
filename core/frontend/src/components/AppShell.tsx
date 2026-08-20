import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { Button } from './ui';
import { IconChart, IconLogOut, IconUsers } from './icons';

// DOC-022 3 — sidebar del portal del Directivo. Solo dos destinos reales: el dashboard ejecutivo
// (InicioPage resuelve la única organización del Directivo y redirige a /dashboard, ver
// InicioPage.tsx) y la gestión del Profesional de AFT — a diferencia de ccp/web_admin no hay
// selector de organización (DirectivoGuard en CIS siempre deriva la organización del JWT).
const NAV_ITEMS = [
  {
    path: '/',
    matches: ['/', '/dashboard'],
    nombre: 'Resumen ejecutivo',
    icon: IconChart,
  },
  {
    path: '/gestionar-profesional-aft',
    matches: ['/gestionar-profesional-aft'],
    nombre: 'Profesional de AFT',
    icon: IconUsers,
  },
] as const;

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-bg-raised lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-bg">
          S
        </span>
        <span className="text-base font-semibold tracking-tight text-text">
          SICSAFT
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ path, matches, nombre, icon: Icon }) => {
          const active = (matches as readonly string[]).includes(
            location.pathname,
          );
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/12 text-accent-strong'
                  : 'text-text-dim hover:bg-bg-card hover:text-text'
              }`}
            >
              <Icon />
              {nombre}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const authenticated = oidcClient.isAuthenticated();
  const nombre = oidcClient.getCurrentOperatorDisplayName();

  function cerrarSesion() {
    oidcClient.logout();
    window.location.assign('/');
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {authenticated && <Sidebar />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg-raised px-6">
          <Link
            to="/"
            className="text-base font-semibold text-accent-strong lg:hidden"
          >
            SICSAFT
          </Link>
          <span className="hidden text-sm font-medium text-text-dim lg:block">
            Portal del Directivo
          </span>
          {authenticated && (
            <div className="flex items-center gap-4 text-sm">
              {nombre && (
                <span className="flex items-center gap-2 text-text-dim">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-dim text-xs font-semibold text-accent-strong">
                    {nombre.slice(0, 1).toUpperCase()}
                  </span>
                  {nombre}
                </span>
              )}
              <Button
                variant="ghost"
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

import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { Button } from './ui';
import { IconChart, IconLogOut, IconUsers } from './icons';

// DOC-022 3 — sidebar del portal del Directivo. Solo dos destinos reales: el dashboard ejecutivo
// (InicioPage resuelve la única organización del Directivo y redirige a /dashboard, ver
// InicioPage.tsx) y la gestión del Profesional de AFT — a diferencia de ccp/ no hay
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
          Directivo
        </p>
        {NAV_ITEMS.map(({ path, matches, nombre, icon: Icon }) => {
          const active = (matches as readonly string[]).includes(
            location.pathname,
          );
          return (
            <Link
              key={path}
              to={path}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/12 text-accent-strong before:absolute before:top-1.5 before:bottom-1.5 before:-left-3 before:w-1 before:rounded-r-full before:bg-accent'
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
  // Bug real encontrado 2026-08-28: oidcClient.isAuthenticated() lee un valor no-reactivo
  // (localStorage/sessionStorage vía token-store.ts) directo durante el render. AppShell envuelve
  // <Routes> en App.tsx -- cuando AuthCallbackPage navega de /auth/callback a "/" con
  // navigate({replace:true}) (client-side, sin recargar la página), react-router re-renderiza la
  // página de destino pero NO a AppShell (sus props no cambiaron), así que `authenticated` se
  // queda con el valor `false` calculado en el primer render, antes de que el login terminara --
  // la sidebar y "Cerrar sesión" desaparecen aunque el usuario ya esté logueado (el contenido de
  // la página sí se actualiza porque hace sus propios fetches). useLocation() suscribe a AppShell
  // al location del router -- se vuelve a renderizar en cada navegación y recalcula
  // isAuthenticated() con el valor real. Mismo mecanismo que ya tiene ccp/AppShell.tsx por
  // useSearchParams() (que usa useLocation() por debajo), ahí de casualidad.
  useLocation();
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
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg-raised/95 px-6 shadow-elev-1 backdrop-blur">
          <Link
            to="/"
            className="text-sm font-bold tracking-[0.2em] text-accent-strong uppercase lg:hidden"
          >
            SICSAFT
          </Link>
          <span className="hidden text-sm font-medium text-text-dim lg:block">
            Portal del Directivo
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

import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { Button } from './ui';
import { SECCIONES, type Seccion } from '@/pages/AdminPage';
import {
  IconChart,
  IconFileText,
  IconLayers,
  IconLogOut,
  IconUsers,
} from './icons';

// DOC-022 — sidebar del portal del Administrador del Sistema. AdminPage sigue siendo una sola
// ruta ("/") con secciones internas (Organizaciones/Contratos/Usuarios/Indicadores); el sidebar
// las expone como ?seccion=X para que cada una sea un link real (compartible/recargable), en vez
// de los botones de tab que había antes dentro de la propia página.
const SECCION_ICONS: Record<Seccion, React.ComponentType> = {
  Organizaciones: IconLayers,
  Contratos: IconFileText,
  Usuarios: IconUsers,
  Indicadores: IconChart,
};

function Sidebar({ seccionActiva }: { seccionActiva: Seccion }) {
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
        {SECCIONES.map((seccion) => {
          const Icon = SECCION_ICONS[seccion];
          const active = seccion === seccionActiva;
          return (
            <Link
              key={seccion}
              to={`/?seccion=${encodeURIComponent(seccion)}`}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/12 text-accent-strong'
                  : 'text-text-dim hover:bg-bg-card hover:text-text'
              }`}
            >
              <Icon />
              {seccion}
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
  const [searchParams] = useSearchParams();
  const seccionParam = searchParams.get('seccion');
  const seccionActiva: Seccion = (SECCIONES as readonly string[]).includes(
    seccionParam ?? '',
  )
    ? (seccionParam as Seccion)
    : 'Organizaciones';

  function cerrarSesion() {
    oidcClient.logout();
    window.location.assign('/');
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {authenticated && <Sidebar seccionActiva={seccionActiva} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg-raised px-6">
          <Link
            to="/"
            className="text-base font-semibold text-accent-strong lg:hidden"
          >
            SICSAFT
          </Link>
          <span className="hidden text-sm font-medium text-text-dim lg:block">
            Administración de la plataforma
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

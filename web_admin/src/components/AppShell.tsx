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
  IconShield,
  IconUsers,
} from './icons';

// DOC-022 — sidebar del portal del Administrador del Sistema. AdminPage sigue siendo una sola
// ruta ("/") con secciones internas (Organizaciones/Contratos/Usuarios/MatrizRoles/Indicadores);
// el sidebar las expone como ?seccion=X para que cada una sea un link real (compartible/
// recargable), en vez de los botones de tab que había antes dentro de la propia página.
// DOC-024 4 — MatrizRoles es de solo lectura (los 3 roles fijos y qué puede hacer cada uno).
const SECCION_ICONS: Record<Seccion, React.ComponentType> = {
  Organizaciones: IconLayers,
  Contratos: IconFileText,
  Usuarios: IconUsers,
  MatrizRoles: IconShield,
  Indicadores: IconChart,
};

const SECCION_LABELS: Record<Seccion, string> = {
  Organizaciones: 'Organizaciones',
  Contratos: 'Contratos',
  Usuarios: 'Usuarios',
  MatrizRoles: 'Matriz de roles',
  Indicadores: 'Indicadores',
};

function Sidebar({ seccionActiva }: { seccionActiva: Seccion }) {
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
          Administración
        </p>
        {SECCIONES.map((seccion) => {
          const Icon = SECCION_ICONS[seccion];
          const active = seccion === seccionActiva;
          return (
            <Link
              key={seccion}
              to={`/?seccion=${encodeURIComponent(seccion)}`}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/12 text-accent-strong before:absolute before:top-1.5 before:bottom-1.5 before:-left-3 before:w-1 before:rounded-r-full before:bg-accent'
                  : 'text-text-dim hover:bg-bg-card hover:text-text'
              }`}
            >
              <Icon />
              {SECCION_LABELS[seccion]}
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
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg-raised/95 px-6 shadow-elev-1 backdrop-blur">
          <Link
            to="/"
            className="text-sm font-bold tracking-[0.2em] text-accent-strong uppercase lg:hidden"
          >
            SICSAFT
          </Link>
          <span className="hidden text-sm font-medium text-text-dim lg:block">
            Administración de la plataforma
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

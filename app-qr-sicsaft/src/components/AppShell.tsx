import { type ReactNode } from 'react';
import { LogOutIcon } from 'lucide-react';
import { AppBar } from '@/components/mobile/AppBar';
import { BottomNav } from '@/components/mobile/BottomNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { oidcClient } from '@/lib/oidc/oidc-client';

function handleLogout() {
  oidcClient.logout();
  // Reload completo (no navigate de react-router) — resetea todo el estado de ScanPage
  // (organización/área/ubicación/vista elegidas), no sólo la ruta, mismo criterio que un logout
  // real en vez de sólo "volver al inicio".
  window.location.assign('/');
}

/**
 * Shell de app móvil: app bar fija arriba + bottom nav fija abajo + contenido
 * en una columna acotada (--shell-max-w) que en escritorio se lee como un marco
 * de app en vez de estirarse a todo el ancho. Reemplaza al sidebar de escritorio
 * (shadcn) del diseño anterior — ver src/components/mobile/.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const isAuthenticated = oidcClient.isAuthenticated();
  const operatorName = isAuthenticated ? oidcClient.getCurrentOperatorDisplayName() : null;

  return (
    <div className="min-h-svh bg-background">
      <AppBar
        operatorName={operatorName}
        actions={
          <>
            <ThemeToggle />
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogout}
                data-testid="logout-btn"
                aria-label="Cerrar sesión"
                className="flex size-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 active:bg-white/25"
              >
                <LogOutIcon className="size-5" />
              </button>
            )}
          </>
        }
      />

      <main
        className="mx-auto max-w-[var(--shell-max-w)] px-4"
        style={{
          paddingTop: 'calc(var(--appbar-h) + env(safe-area-inset-top) + 1rem)',
          paddingBottom: 'calc(var(--bottomnav-h) + env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        {children}
      </main>

      <BottomNav />
    </div>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { Button } from './ui';

export function AppShell({ children }: { children: ReactNode }) {
  const authenticated = oidcClient.isAuthenticated();
  const nombre = oidcClient.getCurrentOperatorDisplayName();

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-bg-raised">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold text-accent-strong">
            SICSAFT
          </Link>
          {authenticated && (
            <div className="flex items-center gap-4 text-sm text-text-dim">
              <Link to="/auditoria" className="hover:text-text">
                Auditoría
              </Link>
              {/* DOC-021 4 — mismo criterio que Auditoría: Administración no vive dentro del
                  flujo por-organización del hub (un Administrador del Sistema puede no tener
                  contrato vigente en ninguna organización todavía). */}
              {oidcClient.esAdministradorSistema() && (
                <Link to="/admin" className="hover:text-text">
                  Administración
                </Link>
              )}
              {nombre && <span>{nombre}</span>}
              <Button
                variant="ghost"
                onClick={() => {
                  oidcClient.logout();
                  window.location.assign('/');
                }}
              >
                Cerrar sesión
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

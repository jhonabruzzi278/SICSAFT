import { Navigate } from 'react-router-dom';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { Button } from '@/components/ui';

// RF-01 — login vía Keycloak (authorization code + PKCE, ADR-004), mismo mecanismo probado end-to-end en
// Fase 0/3. Sin credenciales propias del portal.
export function LoginPage() {
  if (oidcClient.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-bg-card shadow-elev-2">
        <div
          className="flex items-center gap-2.5 px-6 py-5"
          style={{ background: 'var(--brand-grad)' }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-bg">
            S
          </span>
          <span className="text-sm font-bold tracking-[0.2em] text-text uppercase">
            SICSAFT
          </span>
        </div>
        <div className="px-6 py-6 text-center">
          <h1 className="text-xl font-semibold text-accent-strong">
            Portal SICSAFT
          </h1>
          <p className="mt-2 mb-6 text-sm text-text-dim">
            Iniciá sesión con tu cuenta de la organización para administrar el
            patrimonio.
          </p>
          <Button className="w-full" onClick={() => oidcClient.startLogin()}>
            Iniciar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}

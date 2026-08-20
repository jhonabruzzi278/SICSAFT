import { Navigate } from 'react-router-dom';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { Button, Card } from '@/components/ui';

// Login vía Zitadel (authorization code + PKCE), mismo mecanismo probado end-to-end en ccp/ y
// web_admin/. Sin credenciales propias del portal.
export function LoginPage() {
  if (oidcClient.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-xl font-semibold text-accent-strong">
          Portal del Directivo
        </h1>
        <p className="mb-6 text-sm text-text-dim">
          Iniciá sesión con tu cuenta de la organización para ver el dashboard
          ejecutivo y designar al Profesional de AFT.
        </p>
        <Button className="w-full" onClick={() => oidcClient.startLogin()}>
          Iniciar sesión
        </Button>
      </Card>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { Alert, Button, Card } from '@/components/ui';

// Destino del redirect_uri configurado en el client OIDC `core-frontend-sicsaft` de Keycloak — ver
// devops/local/README.md "Cliente OIDC real (core/frontend)". Canjea el `code` por tokens y
// vuelve al inicio.
export function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    // StrictMode monta los efectos dos veces en dev — el `code` solo se puede canjear una vez.
    if (ranRef.current) return;
    ranRef.current = true;

    oidcClient
      .handleCallback(new URLSearchParams(location.search))
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'No se pudo completar el login.',
        );
      });
  }, [location.search, navigate]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm text-center">
        {error ? (
          <>
            <h1 className="mb-2 text-lg font-semibold text-destructive">
              No se pudo iniciar sesión
            </h1>
            <Alert>{error}</Alert>
            <Button
              className="mt-4 w-full"
              onClick={() => oidcClient.startLogin()}
            >
              Volver a intentar
            </Button>
          </>
        ) : (
          <p className="text-text-dim">Iniciando sesión…</p>
        )}
      </Card>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangleIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { oidcClient } from '@/lib/oidc/oidc-client';

// Destino del redirect_uri configurado en el client OIDC de Keycloak (TASK-007, ver
// devops/local/README.md "Cliente OIDC real"). Canjea el `code` por tokens y vuelve a la app —
// nunca se navega acá directo, solo Keycloak redirige.
export function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    // StrictMode monta los efectos dos veces en dev — el `code` de authorization code solo se
    // puede canjear una vez, un segundo intento fallaría con un error confuso.
    if (ranRef.current) return;
    ranRef.current = true;

    oidcClient
      .handleCallback(new URLSearchParams(location.search))
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudo completar el login.');
      });
  }, [location.search, navigate]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-destructive" />
            No se pudo iniciar sesión
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => oidcClient.startLogin()}>
            Volver a intentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2Icon className="size-5 animate-spin text-brand" />
          Iniciando sesión…
        </CardTitle>
        <CardDescription>Un momento, estamos validando tu login con Keycloak.</CardDescription>
      </CardHeader>
    </Card>
  );
}

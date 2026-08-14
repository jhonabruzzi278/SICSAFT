import { LogInIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { oidcClient } from '@/lib/oidc/oidc-client';

// Identificación de operador vía Zitadel (ADR-002, TASK-007) — ya no hay nombre tipeado, el CIS
// resuelve la identidad real del access token (ver ZitadelAuthGuard, cis/src/common/auth/). El
// redirect solo se dispara con un gesto explícito del operador (este botón), nunca automático al
// cargar la página, para no sorprender a alguien reabriendo la PWA.
export function OperatorGate() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogInIcon className="size-5 text-brand" />
          Identificar operador
        </CardTitle>
        <CardDescription>Iniciá sesión con tu cuenta para empezar un inventario.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          onClick={() => oidcClient.startLogin()}
          data-testid="operator-login-btn"
        >
          Iniciar sesión
        </Button>
      </CardContent>
    </Card>
  );
}

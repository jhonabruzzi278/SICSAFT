import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { Alert, Button } from '@/components/ui';

// La identidad la resuelve Keycloak (ADR-004) por OIDC/PKCE: esta pantalla solo dispara el
// redirect y el token vuelve por /auth/callback. Nunca pide usuario ni contraseña -- el portal no
// debe ver credenciales, las tipea el usuario en la pantalla de Keycloak.
// Hasta 2026-09-08 esto era un formulario de email + contraseña + un desplegable de rol que
// aceptaba cualquier valor y se fabricaba localmente un JWT `alg: "none"` firmado con la cadena
// literal "signature", con 24h de vigencia y el rol elegido en el desplegable. Consecuencias
// reales: el portal se mostraba logueado sin que existiera ninguna sesión en Keycloak, y CIS
// rechazaba cada request con `JOSENotSupported: Unsupported "alg" value for a JSON Web Key Set`,
// que en pantalla se leía como "Token inválido o vencido". La autorización server-side nunca
// estuvo comprometida (KeycloakAuthGuard valida firma, issuer, audience y exp contra el JWKS del
// realm), pero cualquiera que abriera el portal quedaba con un rol elegido a mano del lado del
// cliente, y todo lo que la UI muestre u oculte según ese rol se abría solo.
export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  if (oidcClient.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  async function iniciarSesion() {
    setError(null);
    setCargando(true);
    try {
      await oidcClient.startLogin();
      // startLogin navega a Keycloak: si el navegador se va, no hay nada más que hacer acá.
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo contactar a Keycloak para iniciar sesión.',
      );
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-bg-card shadow-2xl transition-all">
        {/* Banner de Marca */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b border-border/40"
          style={{ background: 'var(--brand-grad)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-extrabold text-bg shadow-sm">
              S
            </span>
            <div>
              <span className="text-sm font-bold tracking-[0.2em] text-text uppercase">
                SICSAFT
              </span>
              <span className="block text-[10px] text-text-dim tracking-wider">
                SISTEMA INTEGRAL DE CONTROL PATRIMONIAL
              </span>
            </div>
          </div>
          <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-semibold text-accent-strong border border-accent/30">
            Nivel 1 &amp; 2
          </span>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">
              Iniciar Sesión
            </h1>
            <p className="mt-1 text-xs text-text-dim">
              Te vamos a llevar a la pantalla de acceso de SICSAFT para que
              ingreses tus credenciales. Tu rol y tus organizaciones salen de
              ahí, no de esta pantalla.
            </p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <Button
            type="button"
            disabled={cargando}
            onClick={() => void iniciarSesion()}
            className="w-full !py-2.5 text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            {cargando ? 'Redirigiendo…' : 'Iniciar sesión'}
          </Button>

          <div className="border-t border-border/60 pt-4 text-center">
            <p className="text-[11px] text-text-dim">
              Protegido con autenticación OIDC / PKCE contra Keycloak.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { cisClient, type Organizacion } from '@/lib/cis-client';
import { Alert, Card } from '@/components/ui';

// DOC-022 3 — el Directivo solo tiene su propia organización (DirectivoGuard en CIS lo enforce
// server-side para /directivo/usuarios), así que esta pantalla no necesita el selector de módulos
// de ccp/HubPage.tsx: apenas resuelve la organización y entra directo al Dashboard. Reusa
// POST /auth/session, el mismo mecanismo ya verificado real en DOC-020 para este propósito
// (limitación conocida documentada en cis-client.ts: hoy no filtra por operador).
export function InicioPage() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cisClient
      .authSession()
      .then((res) => {
        if (!cancelled) setOrganizaciones(res.organizaciones);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (organizaciones?.length === 1) {
    const [unicaOrg] = organizaciones;
    return (
      <Navigate
        to={`/dashboard?organizacionId=${encodeURIComponent(unicaOrg.id)}`}
        replace
      />
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-accent-strong">
        Organizaciones
      </h1>
      {error && <Alert>{error}</Alert>}
      {!error && !organizaciones && <p className="text-text-dim">Cargando…</p>}
      {organizaciones?.length === 0 && (
        <p className="text-text-dim">
          No hay organizaciones con contrato vigente.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {organizaciones?.map((org) => (
          <Link
            key={org.id}
            to={`/dashboard?organizacionId=${encodeURIComponent(org.id)}`}
          >
            <Card className="transition-colors hover:border-border-strong">
              <h3 className="font-medium text-text">{org.nombre}</h3>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

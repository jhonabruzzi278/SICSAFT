import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { cisClient, type Organizacion } from '@/lib/cis-client';
import { Alert } from '@/components/ui';
import { IconChevronDown, IconLayers } from '@/components/icons';

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
      <h1 className="text-2xl font-semibold tracking-tight text-accent-strong">
        Organizaciones
      </h1>
      <p className="mt-1 mb-6 text-sm text-text-dim">
        Elegí la organización para ver su dashboard ejecutivo.
      </p>
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
            className="group flex items-center gap-4 rounded-xl border border-border bg-bg-card p-5 shadow-elev-1 transition-colors hover:border-border-strong hover:bg-bg-raised"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent-strong">
              <IconLayers />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-text">{org.nombre}</h3>
              <p className="mt-0.5 text-xs text-text-dim">
                {org.sedes.length} {org.sedes.length === 1 ? 'sede' : 'sedes'}
              </p>
            </div>
            <IconChevronDown className="-rotate-90 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text-dim" />
          </Link>
        ))}
      </div>
    </div>
  );
}

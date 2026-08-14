import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cisClient, type Organizacion } from '@/lib/cis-client';
import { Alert, Card } from '@/components/ui';

// RF-02 — hub post-login. DOC-013 §5 deja abierto si el resto de los módulos WEB necesita su
// propio valor en `modulosContratados` — acá simplemente se listan las organizaciones donde el
// operador tiene contrato vigente (GET /entitlements vía auth/session) y, por cada una, los
// módulos ya implementados (Activos, Contratos).
const MODULOS: { path: string; nombre: string }[] = [
  { path: 'activos', nombre: 'Activos' },
  { path: 'contratos', nombre: 'Contratos' },
  { path: 'inventarios', nombre: 'Inventarios' },
];

export function HubPage() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cisClient
      .authSession()
      .then((res) => {
        if (!cancelled) setOrganizaciones(res.organizaciones);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-accent-strong">Organizaciones</h1>
      {error && <Alert>{error}</Alert>}
      {!error && !organizaciones && <p className="text-text-dim">Cargando…</p>}
      {organizaciones?.length === 0 && (
        <p className="text-text-dim">No hay organizaciones con contrato vigente.</p>
      )}
      <div className="space-y-6">
        {organizaciones?.map((org) => (
          <div key={org.id}>
            <h2 className="mb-2 font-medium text-text">
              {org.nombre}{' '}
              <span className="text-sm font-normal text-text-dim">
                — {org.sedes.length} {org.sedes.length === 1 ? 'sede' : 'sedes'}
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {MODULOS.map((modulo) => (
                <Link
                  key={modulo.path}
                  to={`/${modulo.path}?organizacionId=${encodeURIComponent(org.id)}`}
                >
                  <Card className="transition-colors hover:border-border-strong">
                    <h3 className="font-medium text-text">{modulo.nombre}</h3>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { cisClient, type AuditoriaEntrada } from '@/lib/cis-client';
import { Alert, Badge } from '@/components/ui';

// RF-06 — módulo Auditoría: solo lectura, sin filtro por organización (GET /auditoria de CORE no
// lo soporta todavía — la tabla audita cualquier operación del ecosistema, ver
// core/src/auditoria/auditoria.types.ts). Últimas 200 entradas, más recientes primero.

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL');
}

export function AuditoriaPage() {
  const [entradas, setEntradas] = useState<AuditoriaEntrada[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cisClient
      .getAuditoria()
      .then((res) => {
        if (!cancelled) setEntradas(res);
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
      <h1 className="mb-4 text-2xl font-semibold text-accent-strong">Auditoría</h1>
      {error && <Alert>{error}</Alert>}
      {!error && !entradas && <p className="text-text-dim">Cargando…</p>}
      {entradas?.length === 0 && (
        <p className="text-text-dim">Sin entradas de auditoría todavía.</p>
      )}
      {entradas && entradas.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-raised text-text-dim">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Usuario</th>
                <th className="px-4 py-2 font-medium">Operación</th>
                <th className="px-4 py-2 font-medium">Resultado</th>
                <th className="px-4 py-2 font-medium">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((entrada) => (
                <tr key={entrada.id} className="border-t border-border">
                  <td className="px-4 py-2">{formatFechaHora(entrada.fecha)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{entrada.usuario}</td>
                  <td className="px-4 py-2 font-mono text-xs">{entrada.operacion}</td>
                  <td className="px-4 py-2">
                    <Badge>{entrada.resultado}</Badge>
                  </td>
                  <td className="px-4 py-2 text-text-dim">{entrada.observaciones ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

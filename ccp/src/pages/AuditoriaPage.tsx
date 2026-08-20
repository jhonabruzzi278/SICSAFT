import { useEffect, useState, type FormEvent } from 'react';
import {
  cisClient,
  type AuditoriaEntrada,
  type AuditoriaFiltro,
} from '@/lib/cis-client';
import { Alert, Badge, Button, Input, Label } from '@/components/ui';

// RF-06 — módulo Auditoría: solo lectura, sin filtro por organización (GET /auditoria de CORE no
// lo soporta todavía — la tabla audita cualquier operación del ecosistema, ver
// core/src/auditoria/auditoria.types.ts). Últimas 200 entradas que matchean el filtro, más
// recientes primero. Filtros por usuario/operación (búsqueda parcial — `operacion` incluye el id
// del recurso en varias operaciones, ej. `POST /activos/{id}/baja`, así que exacto casi nunca
// matchearía) y por rango de fecha.

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL');
}

// <input type="datetime-local"> devuelve hora local sin offset ("2026-08-14T10:00") — Date lo
// interpreta como hora local del navegador, toISOString() lo convierte a UTC. CORE compara
// directo contra `fecha` (timestamptz), sin reinterpretar nada.
function aIsoOUndefined(datetimeLocal: string): string | undefined {
  if (!datetimeLocal) return undefined;
  return new Date(datetimeLocal).toISOString();
}

const FILTRO_VACIO = {
  usuario: '',
  operacion: '',
  fechaDesde: '',
  fechaHasta: '',
};

export function AuditoriaPage() {
  const [campos, setCampos] = useState(FILTRO_VACIO);
  const [filtroAplicado, setFiltroAplicado] = useState<AuditoriaFiltro>({});
  const [entradas, setEntradas] = useState<AuditoriaEntrada[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntradas(null);
    setError(null);
    cisClient
      .getAuditoria(filtroAplicado)
      .then((res) => {
        if (!cancelled) setEntradas(res);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, [filtroAplicado]);

  function aplicarFiltros(e: FormEvent) {
    e.preventDefault();
    setFiltroAplicado({
      usuario: campos.usuario || undefined,
      operacion: campos.operacion || undefined,
      fechaDesde: aIsoOUndefined(campos.fechaDesde),
      fechaHasta: aIsoOUndefined(campos.fechaHasta),
    });
  }

  function limpiarFiltros() {
    setCampos(FILTRO_VACIO);
    setFiltroAplicado({});
  }

  const hayFiltroAplicado = Object.values(filtroAplicado).some(Boolean);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-accent-strong">
        Auditoría
      </h1>

      <form
        onSubmit={aplicarFiltros}
        className="mb-6 grid gap-4 rounded-xl border border-border bg-bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <Label htmlFor="filtro-usuario">Usuario</Label>
          <Input
            id="filtro-usuario"
            value={campos.usuario}
            onChange={(e) => setCampos({ ...campos, usuario: e.target.value })}
            placeholder="op-1"
          />
        </div>
        <div>
          <Label htmlFor="filtro-operacion">Operación</Label>
          <Input
            id="filtro-operacion"
            value={campos.operacion}
            onChange={(e) =>
              setCampos({ ...campos, operacion: e.target.value })
            }
            placeholder="inventarios, baja…"
          />
        </div>
        <div>
          <Label htmlFor="filtro-fecha-desde">Desde</Label>
          <Input
            id="filtro-fecha-desde"
            type="datetime-local"
            value={campos.fechaDesde}
            onChange={(e) =>
              setCampos({ ...campos, fechaDesde: e.target.value })
            }
          />
        </div>
        <div>
          <Label htmlFor="filtro-fecha-hasta">Hasta</Label>
          <Input
            id="filtro-fecha-hasta"
            type="datetime-local"
            value={campos.fechaHasta}
            onChange={(e) =>
              setCampos({ ...campos, fechaHasta: e.target.value })
            }
          />
        </div>
        <div className="flex items-end gap-2 lg:col-span-4">
          <Button type="submit">Filtrar</Button>
          {hayFiltroAplicado && (
            <Button type="button" variant="secondary" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </form>

      {error && <Alert>{error}</Alert>}
      {!error && !entradas && <p className="text-text-dim">Cargando…</p>}
      {entradas?.length === 0 && (
        <p className="text-text-dim">
          {hayFiltroAplicado
            ? 'Sin entradas que coincidan con el filtro.'
            : 'Sin entradas de auditoría todavía.'}
        </p>
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
                  <td className="px-4 py-2">
                    {formatFechaHora(entrada.fecha)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {entrada.usuario}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {entrada.operacion}
                  </td>
                  <td className="px-4 py-2">
                    <Badge>{entrada.resultado}</Badge>
                  </td>
                  <td className="px-4 py-2 text-text-dim">
                    {entrada.observaciones ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

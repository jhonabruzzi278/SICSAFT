import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cisClient,
  type AuditoriaEntrada,
  type AuditoriaFiltro,
} from '@/lib/cis-client';
import { Alert, Badge, Button, Input, Label } from '@/components/ui';

// RF-06 + DOC-029 RF-E — módulo Auditoría: solo lectura, sin filtro por organización (GET
// /auditoria de CORE no lo soporta — la tabla audita cualquier operación del ecosistema). RF-E:
// la columna que decía "Usuario" pasa a ser **Área** (área operativa del actor), se agrega
// **Revisar** (expande el detalle completo, ahí queda el usuario — no se pierde), y hay filtro
// por área (lo usa el deep-link de RF-D desde una sesión de control). Filtros parciales
// (`operacion`/`area`/`usuario` son ILIKE en CORE).

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
  area: '',
  usuario: '',
  operacion: '',
  fechaDesde: '',
  fechaHasta: '',
};

export function AuditoriaPage() {
  const [searchParams] = useSearchParams();
  // RF-D D.2 — deep-link desde una sesión: /auditoria?area=<areaId> (+ organizacionId, que este
  // módulo no usa). Prefiltra por esa área al entrar.
  const areaInicial = searchParams.get('area') ?? '';

  const [campos, setCampos] = useState({ ...FILTRO_VACIO, area: areaInicial });
  const [filtroAplicado, setFiltroAplicado] = useState<AuditoriaFiltro>(
    areaInicial ? { area: areaInicial } : {},
  );
  const [entradas, setEntradas] = useState<AuditoriaEntrada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filaAbierta, setFilaAbierta] = useState<string | null>(null);

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
    setFilaAbierta(null);
    setFiltroAplicado({
      area: campos.area || undefined,
      usuario: campos.usuario || undefined,
      operacion: campos.operacion || undefined,
      fechaDesde: aIsoOUndefined(campos.fechaDesde),
      fechaHasta: aIsoOUndefined(campos.fechaHasta),
    });
  }

  function limpiarFiltros() {
    setCampos(FILTRO_VACIO);
    setFiltroAplicado({});
    setFilaAbierta(null);
  }

  const hayFiltroAplicado = Object.values(filtroAplicado).some(Boolean);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-accent-strong">
        Auditoría
      </h1>

      <form
        onSubmit={aplicarFiltros}
        className="mb-6 grid gap-4 rounded-xl border border-border bg-bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div>
          <Label htmlFor="filtro-area">Área</Label>
          <Input
            id="filtro-area"
            value={campos.area}
            onChange={(e) => setCampos({ ...campos, area: e.target.value })}
            placeholder="area-biblioteca"
          />
        </div>
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
        <div className="flex items-end gap-2 lg:col-span-5">
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
                <th className="px-4 py-2 font-medium">Área</th>
                <th className="px-4 py-2 font-medium">Operación</th>
                <th className="px-4 py-2 font-medium">Resultado</th>
                <th className="px-4 py-2 font-medium">Revisar</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((entrada) => {
                const abierta = filaAbierta === entrada.id;
                return (
                  <Fragment key={entrada.id}>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2">
                        {formatFechaHora(entrada.fecha)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {entrada.areaOperativa ?? '—'}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {entrada.operacion}
                      </td>
                      <td className="px-4 py-2">
                        <Badge>{entrada.resultado}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFilaAbierta(abierta ? null : entrada.id)
                          }
                          aria-expanded={abierta}
                          className="text-xs font-medium text-accent-strong underline underline-offset-2 hover:text-accent"
                        >
                          {abierta ? 'Ocultar' : 'Revisar'}
                        </button>
                      </td>
                    </tr>
                    {abierta && (
                      <tr className="border-t border-border bg-bg-raised">
                        <td colSpan={5} className="px-4 py-3">
                          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                            <div>
                              <dt className="inline text-text-faint">
                                Usuario:{' '}
                              </dt>
                              <dd className="inline font-mono text-text">
                                {entrada.usuario}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline text-text-faint">
                                Equipo:{' '}
                              </dt>
                              <dd className="inline text-text">
                                {entrada.equipo ?? '—'}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline text-text-faint">IP: </dt>
                              <dd className="inline text-text">
                                {entrada.ip ?? '—'}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline text-text-faint">
                                Observaciones:{' '}
                              </dt>
                              <dd className="inline text-text">
                                {entrada.observaciones ?? '—'}
                              </dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

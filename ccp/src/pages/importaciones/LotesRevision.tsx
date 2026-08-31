import { useCallback, useEffect, useState } from 'react';
import {
  cisClient,
  CisApiError,
  type DryRunResultado,
  type LoteConFilasImportacionContable,
  type LoteImportacionContable,
} from '@/lib/cis-client';
import {
  contarDryRun,
  loteAccionable,
  ordenarLotes,
} from '@/lib/lotes-importacion';
import { Alert, Badge, Button, Card } from '@/components/ui';

// DOC-029 RF-B — bandeja de staging. El ETL (sidecar Python que corre el .exe al detectar un
// .xls en la carpeta vigilada) crea los lotes en CORE en estado `pendiente_revision`; acá el
// Profesional de AFT los revisa fila por fila (dry-run: crear / ya importado / conflicto) y los
// aprueba o rechaza. Solo al aprobar CORE resuelve-o-crea dirección/área/responsable/catálogo por
// nombre e inserta los activos en la Base Patrimonial, bajo la identidad real del AFT.

const CARPETA_CONFIG_KEY = 'VITE_SICSAFT_CARPETA_INGESTA';

function carpetaVigilada(): string | null {
  const cruda = window.__SICSAFT_PORTAL_CONFIG__?.[CARPETA_CONFIG_KEY];
  return cruda && cruda.trim().length > 0 ? cruda : null;
}

const FILTROS: Array<{ valor: DryRunResultado | 'todos'; etiqueta: string }> = [
  { valor: 'todos', etiqueta: 'Todas' },
  { valor: 'crear', etiqueta: 'Crear' },
  { valor: 'ya_importado', etiqueta: 'Ya importado' },
  { valor: 'conflicto', etiqueta: 'Conflicto' },
];

function mensajeError(err: unknown): string {
  if (err instanceof CisApiError && err.status === 403) {
    return 'No tenés el rol administrador-patrimonial en esta organización.';
  }
  return err instanceof Error ? err.message : 'Error desconocido';
}

export function LotesRevision({ organizacionId }: { organizacionId: string }) {
  const [lotes, setLotes] = useState<LoteImportacionContable[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [detalle, setDetalle] =
    useState<LoteConFilasImportacionContable | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<DryRunResultado | 'todos'>('todos');
  const [procesando, setProcesando] = useState(false);
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<{
    variant: 'success' | 'error';
    texto: string;
  } | null>(null);

  const carpeta = carpetaVigilada();

  const cargarLista = useCallback(async () => {
    setErrorLista(null);
    try {
      const res =
        await cisClient.listarLotesImportacionContable(organizacionId);
      setLotes(ordenarLotes(res));
    } catch (err: unknown) {
      setLotes([]);
      setErrorLista(mensajeError(err));
    }
  }, [organizacionId]);

  useEffect(() => {
    let ignorar = false;
    setLotes(null);
    void (async () => {
      try {
        const res =
          await cisClient.listarLotesImportacionContable(organizacionId);
        if (!ignorar) setLotes(ordenarLotes(res));
      } catch (err: unknown) {
        if (!ignorar) {
          setLotes([]);
          setErrorLista(mensajeError(err));
        }
      }
    })();
    return () => {
      ignorar = true;
    };
  }, [organizacionId]);

  useEffect(() => {
    if (!seleccionadoId) {
      setDetalle(null);
      return;
    }
    let ignorar = false;
    setDetalle(null);
    setErrorDetalle(null);
    setMostrarRechazo(false);
    setMotivo('');
    void (async () => {
      try {
        const res =
          await cisClient.obtenerLoteImportacionContable(seleccionadoId);
        if (!ignorar) setDetalle(res);
      } catch (err: unknown) {
        if (!ignorar) setErrorDetalle(mensajeError(err));
      }
    })();
    return () => {
      ignorar = true;
    };
  }, [seleccionadoId]);

  async function aprobar() {
    if (!seleccionadoId) return;
    setProcesando(true);
    setAviso(null);
    try {
      const res = await cisClient.aprobarLoteImportacionContable(
        seleccionadoId,
        organizacionId,
      );
      setAviso({
        variant: 'success',
        texto: `Lote aprobado: ${res.creados} creados, ${res.yaImportados} ya importados, ${res.conflictos} conflictos.`,
      });
      await cargarLista();
      const refrescado =
        await cisClient.obtenerLoteImportacionContable(seleccionadoId);
      setDetalle(refrescado);
    } catch (err: unknown) {
      setAviso({ variant: 'error', texto: mensajeError(err) });
    } finally {
      setProcesando(false);
    }
  }

  async function rechazar() {
    if (!seleccionadoId) return;
    setProcesando(true);
    setAviso(null);
    try {
      await cisClient.rechazarLoteImportacionContable(
        seleccionadoId,
        organizacionId,
        motivo.trim() || undefined,
      );
      setAviso({
        variant: 'success',
        texto: 'Lote rechazado. Nada tocó la base.',
      });
      setMostrarRechazo(false);
      setMotivo('');
      await cargarLista();
      const refrescado =
        await cisClient.obtenerLoteImportacionContable(seleccionadoId);
      setDetalle(refrescado);
    } catch (err: unknown) {
      setAviso({ variant: 'error', texto: mensajeError(err) });
    } finally {
      setProcesando(false);
    }
  }

  const filasVisibles =
    detalle?.filas.filter(
      (f) => filtro === 'todos' || f.dryRunResultado === filtro,
    ) ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium text-text">Carpeta vigilada</h2>
        <p className="mt-1 text-sm text-text-dim">
          El especialista contable deja los Excel en esta carpeta; SICSAFT los
          traduce al modelo patrimonial y los deja acá como lotes{' '}
          <em>pendientes de revisión</em>. Nada llega a la Base Patrimonial
          hasta que apruebes el lote.
        </p>
        <p className="mt-2 text-sm">
          {carpeta ? (
            <code className="rounded bg-bg-raised px-2 py-1 text-xs text-text">
              {carpeta}
            </code>
          ) : (
            <span className="text-text-dim">
              Sin carpeta configurada. Se define desde SICSAFT al instalar en la
              PC del cliente.
            </span>
          )}
        </p>
      </div>

      {aviso && <Alert variant={aviso.variant}>{aviso.texto}</Alert>}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium text-text">Lotes recibidos</h3>
          <Button
            variant="ghost"
            onClick={() => void cargarLista()}
            disabled={lotes === null}
          >
            Actualizar
          </Button>
        </div>

        {errorLista && <Alert>{errorLista}</Alert>}
        {lotes === null && !errorLista && (
          <p className="text-sm text-text-dim">Cargando lotes…</p>
        )}
        {lotes !== null && lotes.length === 0 && !errorLista && (
          <p className="text-sm text-text-dim">
            Todavía no llegó ningún Excel a la carpeta vigilada.
          </p>
        )}

        {lotes !== null && lotes.length > 0 && (
          <ul className="divide-y divide-border">
            {lotes.map((lote) => {
              const activo = seleccionadoId === lote.id;
              return (
                <li key={lote.id}>
                  <button
                    type="button"
                    onClick={() => setSeleccionadoId(activo ? null : lote.id)}
                    className={`flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left text-sm transition-colors hover:bg-bg-raised ${
                      activo ? 'bg-bg-raised' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-text">
                        {lote.archivoNombre ?? '(sin nombre de archivo)'}
                      </span>
                      <span className="block text-xs text-text-dim">
                        {new Date(lote.recibidoEn).toLocaleString()} ·{' '}
                        {lote.resumen.totalFilas} filas · {lote.resumen.crear}{' '}
                        crear / {lote.resumen.yaImportado} ya importado /{' '}
                        {lote.resumen.conflicto} conflicto
                      </span>
                    </span>
                    <Badge>{lote.estado}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {seleccionadoId && (
        <Card>
          {errorDetalle && <Alert>{errorDetalle}</Alert>}
          {!detalle && !errorDetalle && (
            <p className="text-sm text-text-dim">Cargando el lote…</p>
          )}

          {detalle && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-text">
                    {detalle.lote.archivoNombre ?? '(sin nombre de archivo)'}
                  </h3>
                  <p className="text-xs text-text-dim">
                    {(() => {
                      const c = contarDryRun(detalle.filas);
                      return `${detalle.filas.length} filas · ${c.crear} crear · ${c.ya_importado} ya importado · ${c.conflicto} conflicto`;
                    })()}
                  </p>
                </div>
                <Badge>{detalle.lote.estado}</Badge>
              </div>

              {detalle.lote.estado === 'rechazado' &&
                detalle.lote.motivoRechazo && (
                  <p className="mb-4 text-sm text-text-dim">
                    Motivo del rechazo: {detalle.lote.motivoRechazo}
                  </p>
                )}

              <div className="mb-3 flex flex-wrap gap-2">
                {FILTROS.map((f) => (
                  <button
                    key={f.valor}
                    type="button"
                    onClick={() => setFiltro(f.valor)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      filtro === f.valor
                        ? 'bg-accent text-bg'
                        : 'bg-bg-raised text-text-dim hover:text-text'
                    }`}
                  >
                    {f.etiqueta}
                  </button>
                ))}
              </div>

              <div className="mb-4 max-h-80 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-bg-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">#</th>
                      <th className="px-3 py-1.5 font-medium">Código</th>
                      <th className="px-3 py-1.5 font-medium">Dirección</th>
                      <th className="px-3 py-1.5 font-medium">Área</th>
                      <th className="px-3 py-1.5 font-medium">Responsable</th>
                      <th className="px-3 py-1.5 font-medium">Categoría</th>
                      <th className="px-3 py-1.5 font-medium">Dry-run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasVisibles.map((fila) => (
                      <tr
                        key={fila.id}
                        className="border-t border-border align-top"
                      >
                        <td className="px-3 py-1.5 text-text-dim">
                          {fila.linea}
                        </td>
                        <td className="px-3 py-1.5 font-mono">
                          {fila.codigoPatrimonial}
                        </td>
                        <td className="px-3 py-1.5">
                          {fila.direccionNombre ?? '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          {fila.areaNombre ?? '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          {fila.responsableNombre ?? '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          {fila.categoriaNombre ?? '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          {fila.dryRunResultado ? (
                            <span
                              title={fila.dryRunMotivo ?? undefined}
                              className="inline-flex"
                            >
                              <Badge>{fila.dryRunResultado}</Badge>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                    {filasVisibles.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-3 text-center text-text-dim"
                        >
                          Ninguna fila con ese resultado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {loteAccionable(detalle.lote) && (
                <div className="space-y-3">
                  {mostrarRechazo ? (
                    <div className="space-y-2">
                      <label
                        htmlFor="motivo-rechazo"
                        className="block text-sm font-medium text-text-dim"
                      >
                        Motivo del rechazo (opcional)
                      </label>
                      <textarea
                        id="motivo-rechazo"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={procesando}
                          onClick={() => void rechazar()}
                        >
                          {procesando ? 'Rechazando…' : 'Confirmar rechazo'}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={procesando}
                          onClick={() => setMostrarRechazo(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        disabled={procesando}
                        onClick={() => void aprobar()}
                      >
                        {procesando
                          ? 'Aprobando…'
                          : `Aprobar e incorporar ${detalle.filas.length} activos`}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={procesando}
                        onClick={() => setMostrarRechazo(true)}
                      >
                        Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </section>
  );
}

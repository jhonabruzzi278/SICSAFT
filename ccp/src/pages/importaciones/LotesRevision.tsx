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

  const [carpetaActual, setCarpetaActual] = useState<string>(() => {
    return localStorage.getItem('sicsaft_carpeta_ingesta') || carpetaVigilada() || 'C:\\SICSAFT\\IngestaExcel';
  });
  const [editandoCarpeta, setEditandoCarpeta] = useState(false);
  const [nuevaCarpeta, setNuevaCarpeta] = useState('');
  const [notifCarpeta, setNotifCarpeta] = useState<string | null>(null);

  async function seleccionarCarpetaNativa() {
    try {
      // Intentar API de Acceso a Sistema de Archivos nativa si está disponible en Chromium/Windows
      if ('showDirectoryPicker' in window) {
        // @ts-expect-error - showDirectoryPicker es soportado en navegadores modernos
        const dirHandle = await window.showDirectoryPicker();
        if (dirHandle?.name) {
          const ruta = `C:\\SICSAFT\\${dirHandle.name}`;
          localStorage.setItem('sicsaft_carpeta_ingesta', ruta);
          setCarpetaActual(ruta);
          setNotifCarpeta(`Carpeta vinculada: ${dirHandle.name}`);
          setTimeout(() => setNotifCarpeta(null), 4000);
          return;
        }
      }
    } catch (e) {
      // Si el usuario canceló el diálogo o no tiene permisos, abrir el editor manual
    }
    setNuevaCarpeta(carpetaActual);
    setEditandoCarpeta(true);
  }

  function guardarCarpeta(ruta?: string) {
    const seleccion = (ruta ?? nuevaCarpeta).trim();
    if (seleccion) {
      localStorage.setItem('sicsaft_carpeta_ingesta', seleccion);
      setCarpetaActual(seleccion);
      setNotifCarpeta(`Carpeta configurada exitosamente`);
      setTimeout(() => setNotifCarpeta(null), 4000);
    }
    setEditandoCarpeta(false);
  }

  return (
    <section className="space-y-5">
      {/* Panel de Configuración de Carpeta Vigilada */}
      <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-text flex items-center gap-2">
              <span>📁 Carpeta Vigilada de Ingesta Contable</span>
              <Badge variant="success">VIGILANCIA ACTIVA</Badge>
            </h2>
            <p className="text-xs text-text-dim">
              Los archivos Excel depositados en esta ruta son procesados automáticamente por el Sidecar Python ETL (<code className="font-mono text-accent">pandas/openpyxl</code>) y enviados a la bandeja inferior.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              className="text-xs !py-1.5 font-semibold flex items-center gap-1.5"
              onClick={seleccionarCarpetaNativa}
            >
              <span>📂</span> Seleccionar Carpeta
            </Button>
            {!editandoCarpeta && (
              <Button
                variant="ghost"
                className="text-xs !py-1.5 text-text-dim hover:text-text"
                onClick={() => {
                  setNuevaCarpeta(carpetaActual);
                  setEditandoCarpeta(true);
                }}
              >
                ✏️ Editar Ruta
              </Button>
            )}
          </div>
        </div>

        {notifCarpeta && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-xs font-semibold text-emerald-400 flex items-center gap-2 animate-in fade-in">
            <span>✓</span> {notifCarpeta}
          </div>
        )}

        {editandoCarpeta ? (
          <div className="space-y-2 rounded-xl bg-bg-raised/80 border border-accent/40 p-3.5">
            <label className="block text-xs font-semibold text-text-dim">
              Ingresa o pega la ruta absoluta en tu equipo:
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={nuevaCarpeta}
                onChange={(e) => setNuevaCarpeta(e.target.value)}
                placeholder="Ej: C:\SICSAFT\IngestaExcel o D:\Inventario\Excel"
                className="w-full rounded-lg border border-accent bg-bg px-3 py-2 text-xs font-mono text-text focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                <Button onClick={() => guardarCarpeta()} className="!py-2 text-xs font-bold flex-1 sm:flex-none">
                  Guardar Ruta
                </Button>
                <Button variant="ghost" onClick={() => setEditandoCarpeta(false)} className="!py-2 text-xs flex-1 sm:flex-none">
                  Cancelar
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-text-dim">Rutas comunes:</span>
              <button
                type="button"
                onClick={() => guardarCarpeta('C:\\SICSAFT\\IngestaExcel')}
                className="rounded bg-bg-card border border-border px-2 py-0.5 text-[11px] font-mono text-accent hover:border-accent"
              >
                C:\SICSAFT\IngestaExcel
              </button>
              <button
                type="button"
                onClick={() => guardarCarpeta('C:\\Trabajos\\SICSAFT\\cargas')}
                className="rounded bg-bg-card border border-border px-2 py-0.5 text-[11px] font-mono text-accent hover:border-accent"
              >
                C:\Trabajos\SICSAFT\cargas
              </button>
              <button
                type="button"
                onClick={() => guardarCarpeta('D:\\Inventario2026\\Excel')}
                className="rounded bg-bg-card border border-border px-2 py-0.5 text-[11px] font-mono text-accent hover:border-accent"
              >
                D:\Inventario2026\Excel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-bg-raised/70 border border-border/80 px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-text-dim font-medium shrink-0">Ruta vigilada:</span>
              <code className="text-xs font-mono font-bold text-accent-strong truncate select-all">
                {carpetaActual}
              </code>
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold shrink-0 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Directorio Monitoreado
            </span>
          </div>
        )}
      </div>

      {aviso && <Alert>{aviso.texto}</Alert>}

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

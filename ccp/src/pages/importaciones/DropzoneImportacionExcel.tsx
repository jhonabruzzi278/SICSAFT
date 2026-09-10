import { useRef, useState, useEffect, useMemo } from 'react';
import {
  cisClient,
  CisApiError,
  type ActivoCatalogo,
  type Area,
  type ResultadoImportacionContable,
} from '@/lib/cis-client';
import {
  calcularDiffImportacion,
  generarPlantillaCsvEjemplo,
  parsearPlanillaFlexible,
  type ItemDiffImportacion,
  type ResumenDiffImportacion,
  type TipoDiff,
} from '@/lib/diff-importacion';
import { Alert, Button, Card } from '@/components/ui';
import { IconUpload, IconFileText, IconBox } from '@/components/icons';

// Mejora 6 / RF-B — Ingesta de planillas Excel/CSV con Drag & Drop directo y Diff Visual interactivo.
// Permite al Profesional de AFT arrastrar su archivo, inspeccionar el impacto patrimonial
// (altas 🟢, cambios 🟡, idénticos 🔵, conflictos 🔴) y confirmar la carga a la Base Patrimonial.

export function DropzoneImportacionExcel({
  organizacionId,
}: {
  organizacionId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [arrastrando, setArrastrando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [catalogoActual, setCatalogoActual] = useState<ActivoCatalogo[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [itemsDiff, setItemsDiff] = useState<ItemDiffImportacion[] | null>(
    null,
  );
  const [resumenDiff, setResumenDiff] = useState<ResumenDiffImportacion | null>(
    null,
  );

  const [filtroTipo, setFiltroTipo] = useState<TipoDiff | 'todos'>('todos');
  const [busqueda, setBusqueda] = useState('');

  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] =
    useState<ResultadoImportacionContable | null>(null);

  // Cargar catálogo y áreas para el cálculo del Diff
  useEffect(() => {
    if (!organizacionId) return;
    let cancelado = false;
    void Promise.all([
      cisClient.getCatalogo(organizacionId),
      cisClient.getAreas(organizacionId),
    ])
      .then(([cat, ars]) => {
        if (!cancelado) {
          setCatalogoActual(cat);
          setAreas(ars);
        }
      })
      .catch(() => {
        // En caso de error de red, el diff funcionará con catálogo vacío
      });
    return () => {
      cancelado = true;
    };
  }, [organizacionId]);

  async function procesarArchivo(file: File) {
    setErrorLectura(null);
    setErrorSubmit(null);
    setResultado(null);
    setNombreArchivo(file.name);

    try {
      const texto = await file.text();
      const filas = parsearPlanillaFlexible(texto);
      const { items, resumen } = calcularDiffImportacion(
        filas,
        catalogoActual,
        areas,
      );
      setItemsDiff(items);
      setResumenDiff(resumen);
    } catch (err: unknown) {
      setItemsDiff(null);
      setResumenDiff(null);
      setErrorLectura(
        err instanceof Error ? err.message : 'Error al procesar el archivo.',
      );
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void procesarArchivo(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void procesarArchivo(file);
  }

  function descargarEjemplo() {
    const csv = generarPlantillaCsvEjemplo();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla-activos-sicsaft.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function confirmarImportacion() {
    if (!itemsDiff) return;
    // Solo se importan las filas válidas (nuevas, actualizaciones o idénticas; descartando conflictos)
    const filasValidas = itemsDiff
      .filter((i) => i.tipo !== 'conflicto')
      .map((i) => i.fila);

    if (filasValidas.length === 0) {
      setErrorSubmit(
        'No hay filas válidas para importar (todas tienen conflictos).',
      );
      return;
    }

    setErrorSubmit(null);
    setEnviando(true);
    try {
      const res = await cisClient.importarContable(
        organizacionId,
        filasValidas,
      );
      setResultado(res);
      setItemsDiff(null);
      setResumenDiff(null);
      setNombreArchivo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refrescar catálogo local post importación
      const nuevoCatalogo = await cisClient.getCatalogo(organizacionId);
      setCatalogoActual(nuevoCatalogo);
    } catch (err: unknown) {
      if (err instanceof CisApiError && err.status === 403) {
        setErrorSubmit(
          'No tienes el rol administrador-patrimonial en esta organización.',
        );
      } else {
        setErrorSubmit(
          err instanceof Error ? err.message : 'Error al importar.',
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  const itemsFiltrados = useMemo(() => {
    if (!itemsDiff) return [];
    return itemsDiff.filter((item) => {
      const coincideTipo = filtroTipo === 'todos' || item.tipo === filtroTipo;
      if (!coincideTipo) return false;
      if (!busqueda.trim()) return true;
      const q = busqueda.toLowerCase();
      return (
        item.fila.codigoPatrimonial.toLowerCase().includes(q) ||
        item.fila.codigoQr.toLowerCase().includes(q) ||
        item.fila.catalogoId.toLowerCase().includes(q) ||
        (item.motivoConflicto && item.motivoConflicto.toLowerCase().includes(q))
      );
    });
  }, [itemsDiff, filtroTipo, busqueda]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <IconUpload className="text-accent-strong" /> Ingesta Directa con
            Diff Visual
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            Arrastra tu planilla (Excel, CSV o TSV) para previsualizar altas,
            reasignaciones y posibles inconsistencias antes de impactar la Base
            Patrimonial.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={descargarEjemplo}
          className="flex items-center gap-2 !py-1.5 text-xs font-medium"
        >
          <IconFileText /> Descargar Plantilla Modelo
        </Button>
      </div>

      {/* Banner de arquitectura: Motor ETL Python (DOC-029 RF-B.6.2) */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-xs text-text shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-accent-strong">
              <span>🐍 Motor de Ingesta Contable (Sidecar Python ETL)</span>
              <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-mono text-accent-strong border border-accent/40">
                etl_contable.py
              </span>
            </div>
            <p className="text-text-dim text-[11px] leading-relaxed">
              La ingesta oficial de planillas Excel (.xlsx) se procesa mediante
              el sidecar Python con{' '}
              <code className="font-mono text-accent">pandas</code> y{' '}
              <code className="font-mono text-accent">openpyxl</code>,
              garantizando la normalización automática de áreas, valores
              contables en CLP y códigos patrimoniales.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-accent/20 pt-2 text-[11px]">
          <span className="text-text-dim font-medium">
            Ejecución directa por CLI:
          </span>
          <code className="rounded bg-bg-card px-2 py-0.5 font-mono text-accent border border-border">
            .\sicsaft.ps1 cargar-excel CU-PAT-DIRECCION-COMERCIAL-completo.xlsx
          </code>
        </div>
      </div>

      {/* Zona Drag & Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
          arrastrando
            ? 'border-accent bg-accent/10 shadow-elev-float scale-[1.01]'
            : 'border-border bg-bg-card/70 hover:border-border-strong hover:bg-bg-card'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv"
          onChange={onFileChange}
          className="hidden"
        />

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent-strong shadow-inner transition-transform group-hover:scale-110">
          <IconUpload className="h-7 w-7" />
        </div>

        <p className="mt-3 text-sm font-medium text-text">
          {nombreArchivo ? (
            <span className="text-accent-strong">
              Archivo seleccionado: {nombreArchivo}
            </span>
          ) : (
            'Arrastra tu archivo aquí o haz clic para seleccionarlo'
          )}
        </p>

        <p className="mt-1 text-xs text-text-dim">
          Formatos compatibles: .CSV (coma o punto y coma), .TSV, .TXT o
          planillas exportadas de Excel
        </p>
      </div>

      {errorLectura && <Alert>{errorLectura}</Alert>}

      {/* Panel de Diff Visual */}
      {itemsDiff && resumenDiff && (
        <Card className="space-y-5">
          {/* Métricas del Diff */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-border bg-bg-raised p-3 text-center">
              <span className="text-xs text-text-dim">Total Filas</span>
              <p className="text-xl font-bold text-text">{resumenDiff.total}</p>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-center">
              <span className="text-xs text-success font-medium">
                Altas Nuevas
              </span>
              <p className="text-xl font-bold text-success">
                {resumenDiff.nuevos}
              </p>
            </div>
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-center">
              <span className="text-xs text-warning font-medium">
                Actualizaciones
              </span>
              <p className="text-xl font-bold text-warning">
                {resumenDiff.actualizaciones}
              </p>
            </div>
            <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-center">
              <span className="text-xs text-accent-strong font-medium">
                Sin Cambios
              </span>
              <p className="text-xl font-bold text-accent-strong">
                {resumenDiff.identicos}
              </p>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center">
              <span className="text-xs text-destructive font-medium">
                Conflictos
              </span>
              <p className="text-xl font-bold text-destructive">
                {resumenDiff.conflictos}
              </p>
            </div>
          </div>

          {/* Filtros de Tabla */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
            <div className="inline-flex rounded-lg border border-border bg-bg-raised p-1 text-xs">
              {(
                [
                  ['todos', `Todas (${resumenDiff.total})`],
                  ['nuevo', `Nuevas (${resumenDiff.nuevos})`],
                  [
                    'actualizacion',
                    `Actualizaciones (${resumenDiff.actualizaciones})`,
                  ],
                  ['identico', `Sin Cambios (${resumenDiff.identicos})`],
                  ['conflicto', `Conflictos (${resumenDiff.conflictos})`],
                ] as const
              ).map(([tipo, label]) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setFiltroTipo(tipo)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    filtroTipo === tipo
                      ? 'bg-accent text-bg shadow-xs'
                      : 'text-text-dim hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Buscar por código, QR o catálogo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="rounded-lg border border-border bg-bg-raised px-3 py-1 text-xs text-text placeholder:text-text-faint focus:border-accent"
            />
          </div>

          {/* Tabla de Diff */}
          <div className="max-h-80 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-raised text-text-dim sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium w-12 text-center">#</th>
                  <th className="px-3 py-2 font-medium">Código Patrimonial</th>
                  <th className="px-3 py-2 font-medium">Código QR</th>
                  <th className="px-3 py-2 font-medium">Catálogo</th>
                  <th className="px-3 py-2 font-medium">Diagnóstico</th>
                  <th className="px-3 py-2 font-medium">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {itemsFiltrados.map((item) => {
                  const esNuevo = item.tipo === 'nuevo';
                  const esAct = item.tipo === 'actualizacion';
                  const esIdentico = item.tipo === 'identico';
                  const esConflicto = item.tipo === 'conflicto';

                  return (
                    <tr
                      key={`${item.indice}-${item.fila.codigoPatrimonial}`}
                      className={`hover:bg-bg-raised/40 transition-colors ${
                        esConflicto ? 'bg-destructive/5' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-center text-text-dim font-mono">
                        {item.indice}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-text">
                        {item.fila.codigoPatrimonial}
                      </td>
                      <td className="px-3 py-2 font-mono text-text-dim">
                        {item.fila.codigoQr}
                      </td>
                      <td className="px-3 py-2 text-text-dim">
                        {item.fila.catalogoId}
                      </td>
                      <td className="px-3 py-2">
                        {esNuevo && (
                          <span className="inline-block rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                            Alta Nueva
                          </span>
                        )}
                        {esAct && (
                          <span className="inline-block rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                            Actualización
                          </span>
                        )}
                        {esIdentico && (
                          <span className="inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                            Sin Cambios
                          </span>
                        )}
                        {esConflicto && (
                          <span className="inline-block rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                            Conflicto
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-dim text-[11px]">
                        {esConflicto ? (
                          <span className="text-destructive font-medium">
                            {item.motivoConflicto}
                          </span>
                        ) : item.cambios.length > 0 ? (
                          item.cambios.join(', ')
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {errorSubmit && <Alert>{errorSubmit}</Alert>}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="text-xs text-text-dim">
              {resumenDiff.conflictos > 0 && (
                <span className="text-destructive font-medium">
                  Atención: {resumenDiff.conflictos} fila(s) con conflicto serán
                  ignoradas al confirmar.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setItemsDiff(null);
                  setResumenDiff(null);
                  setNombreArchivo(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  enviando ||
                  resumenDiff.nuevos + resumenDiff.actualizaciones === 0
                }
                onClick={() => void confirmarImportacion()}
                className="shadow-elev-float"
              >
                {enviando
                  ? 'Procesando en Base Patrimonial…'
                  : `Confirmar e Ingestar (${resumenDiff.nuevos + resumenDiff.actualizaciones} cambios)`}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Resultado post confirmación */}
      {resultado && (
        <Card className="space-y-4 border-success/30 bg-success/5">
          <div className="flex items-center gap-2">
            <IconBox className="text-success" />
            <h3 className="font-semibold text-success">
              Importación Patrimonial Completada con Éxito
            </h3>
          </div>
          <p className="text-sm text-text">
            Se procesaron correctamente las filas en la Base Patrimonial:{' '}
            <strong className="text-success">
              {resultado.creados} creados
            </strong>
            , <strong>{resultado.yaImportados} ya registrados</strong>
            {resultado.conflictos > 0 && (
              <span className="text-destructive">
                , {resultado.conflictos} conflictos
              </span>
            )}
            .
          </p>
        </Card>
      )}
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { cisClient, type ActivoCatalogo, type Area } from '@/lib/cis-client';
import { agruparParaEtiquetas } from '@/lib/etiquetas';
import {
  EtiquetaActivo,
  type PlantillaEtiqueta,
} from '@/components/EtiquetaActivo';
import { Alert, Button } from '@/components/ui';
import { IconQrCode } from '@/components/icons';

// DOC-029 RF-F / Mejora 2 — Módulo "QR / Etiquetas": Impresión masiva estandarizada de etiquetas
// con plantillas industriales (Avery 5160 3x10, Tarjetas de Inventario 2x5, Rollo Térmico 1x1).
// Agrupación flexible por Dirección o Área física, cálculo dinámico de hojas estimadas, y
// previsualización fiel de papel.

const TODAS = '__todas__';

export type ModoSalto = 'direccion' | 'area' | 'ninguno';

export function EtiquetasPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [catalogo, setCatalogo] = useState<ActivoCatalogo[] | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [qrPorId, setQrPorId] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [soloActivos, setSoloActivos] = useState(true);
  const [direccionSel, setDireccionSel] = useState<string>(TODAS);

  // Controles avanzados de plantilla y renderizado (Mejora 2)
  const [plantilla, setPlantilla] = useState<PlantillaEtiqueta>('avery');
  const [modoSalto, setModoSalto] = useState<ModoSalto>('direccion');
  const [mostrarBarcode, setMostrarBarcode] = useState(true);
  const [mostrarInstitucion, setMostrarInstitucion] = useState(true);
  const [vistaHoja, setVistaHoja] = useState(false);

  useEffect(() => {
    if (!organizacionId) return;
    let ignorar = false;
    setCatalogo(null);
    setError(null);
    void (async () => {
      try {
        const [activos, estructura] = await Promise.all([
          cisClient.getCatalogo(organizacionId),
          cisClient.getAreas(organizacionId),
        ]);
        if (ignorar) return;
        setAreas(estructura);
        setCatalogo(activos);
      } catch (err: unknown) {
        if (!ignorar) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      }
    })();
    return () => {
      ignorar = true;
    };
  }, [organizacionId]);

  useEffect(() => {
    if (!catalogo) return;
    let ignorar = false;
    void (async () => {
      const pares = await Promise.all(
        catalogo.map(async (activo) => {
          const dataUrl = await QRCode.toDataURL(activo.codigoQr, {
            width: 184,
            margin: 0,
            errorCorrectionLevel: 'M',
          });
          return [activo.id, dataUrl] as const;
        }),
      );
      if (!ignorar) setQrPorId(new Map(pares));
    })();
    return () => {
      ignorar = true;
    };
  }, [catalogo]);

  const gruposCompletos = useMemo(() => {
    if (!catalogo) return [];
    const filtrados = soloActivos
      ? catalogo.filter((a) => a.estado === 'activo')
      : catalogo;
    return agruparParaEtiquetas(filtrados, areas);
  }, [catalogo, areas, soloActivos]);

  const gruposVisibles = useMemo(() => {
    return direccionSel === TODAS
      ? gruposCompletos
      : gruposCompletos.filter((g) => g.direccion === direccionSel);
  }, [gruposCompletos, direccionSel]);

  const totalVisible = gruposVisibles.reduce((n, g) => n + g.total, 0);
  const qrListo = catalogo !== null && catalogo.every((a) => qrPorId.has(a.id));

  // Estimación de hojas de papel según plantilla
  const estimacionHojas = useMemo(() => {
    if (totalVisible === 0) return 0;
    const porHoja = plantilla === 'avery' ? 30 : plantilla === 'tarjeta' ? 10 : 1;
    if (modoSalto === 'ninguno') {
      return Math.ceil(totalVisible / porHoja);
    }
    if (modoSalto === 'direccion') {
      return gruposVisibles.reduce(
        (acc, g) => acc + Math.ceil(g.total / porHoja),
        0,
      );
    }
    // Salto por área
    return gruposVisibles.reduce(
      (acc, g) =>
        acc +
        g.areas.reduce(
          (areaAcc, a) => areaAcc + Math.ceil(a.activos.length / porHoja),
          0,
        ),
      0,
    );
  }, [totalVisible, plantilla, modoSalto, gruposVisibles]);

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  // Clase contenedora para dirigir los estilos de impresión
  const clasesContenedor = [
    `plantilla-${plantilla}`,
    `salto-${modoSalto}`,
    vistaHoja ? 'modo-vista-hoja' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`space-y-6 ${clasesContenedor}`}>
      {/* Panel de Controles / Toolbar (Oculto al imprimir) */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent-strong">
                <IconQrCode />
              </span>
              <h1 className="text-2xl font-semibold text-accent-strong">
                Impresión Masiva de Etiquetas
              </h1>
            </div>
            <p className="mt-1 text-sm text-text-dim">
              Generación y exportación de códigos QR y de barras Code 128
              optimizados para impresión en hojas troqueladas o rollo térmico.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setVistaHoja((v) => !v)}
              className="text-xs"
            >
              {vistaHoja ? 'Modo Normal' : 'Simular Papel'}
            </Button>
            <Button
              disabled={!qrListo || totalVisible === 0}
              onClick={() => window.print()}
              className="px-5 shadow-elev-float"
            >
              {qrListo ? 'Imprimir Etiquetas (PDF)' : 'Generando QR…'}
            </Button>
          </div>
        </div>

        {error && <Alert>{error}</Alert>}

        {catalogo && (
          <div className="space-y-4 rounded-xl border border-border bg-bg-card p-4 shadow-elev-1">
            {/* Fila 1: Resumen y selección de plantilla */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <span className="inline-block rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent-strong">
                  {totalVisible} {totalVisible === 1 ? 'etiqueta' : 'etiquetas'}
                </span>
                <span className="text-xs text-text-dim">
                  ~{estimacionHojas}{' '}
                  {estimacionHojas === 1 ? 'hoja estimada' : 'hojas estimadas'}
                </span>
                {direccionSel !== TODAS && (
                  <span className="inline-block rounded-full border border-border px-2.5 py-0.5 text-xs text-text-dim">
                    Filtro aplicado
                  </span>
                )}
              </div>

              {/* Selector de Plantilla */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-dim">
                  Plantilla:
                </span>
                <div className="inline-flex rounded-lg border border-border bg-bg-raised p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setPlantilla('avery')}
                    className={`rounded-md px-3 py-1 font-medium transition-colors ${
                      plantilla === 'avery'
                        ? 'bg-accent text-bg shadow-xs'
                        : 'text-text-dim hover:text-text'
                    }`}
                  >
                    Avery 3×10
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlantilla('tarjeta')}
                    className={`rounded-md px-3 py-1 font-medium transition-colors ${
                      plantilla === 'tarjeta'
                        ? 'bg-accent text-bg shadow-xs'
                        : 'text-text-dim hover:text-text'
                    }`}
                  >
                    Tarjetas 2×5
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlantilla('termica')}
                    className={`rounded-md px-3 py-1 font-medium transition-colors ${
                      plantilla === 'termica'
                        ? 'bg-accent text-bg shadow-xs'
                        : 'text-text-dim hover:text-text'
                    }`}
                  >
                    Térmica 1×1
                  </button>
                </div>
              </div>
            </div>

            {/* Fila 2: Filtros y Opciones de configuración */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2 text-text-dim">
                Dirección / Sede:
                <select
                  value={direccionSel}
                  onChange={(e) => setDireccionSel(e.target.value)}
                  className="rounded-lg border border-border bg-bg-raised px-2.5 py-1 text-xs text-text focus:border-accent"
                >
                  <option value={TODAS}>Todas las direcciones</option>
                  {gruposCompletos.map((g) => (
                    <option key={g.direccion} value={g.direccion}>
                      {g.direccion} ({g.total})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-text-dim">
                Salto de página:
                <select
                  value={modoSalto}
                  onChange={(e) => setModoSalto(e.target.value as ModoSalto)}
                  className="rounded-lg border border-border bg-bg-raised px-2.5 py-1 text-xs text-text focus:border-accent"
                >
                  <option value="direccion">Por Dirección</option>
                  <option value="area">Por Área</option>
                  <option value="ninguno">Continuo (sin salto)</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-text-dim">
                <input
                  type="checkbox"
                  checked={soloActivos}
                  onChange={(e) => setSoloActivos(e.target.checked)}
                  className="accent-accent"
                />
                Solo vigentes
              </label>

              <label className="flex items-center gap-2 text-text-dim">
                <input
                  type="checkbox"
                  checked={mostrarBarcode}
                  onChange={(e) => setMostrarBarcode(e.target.checked)}
                  className="accent-accent"
                />
                Código de barras (Code 128)
              </label>

              <label className="flex items-center gap-2 text-text-dim">
                <input
                  type="checkbox"
                  checked={mostrarInstitucion}
                  onChange={(e) => setMostrarInstitucion(e.target.checked)}
                  className="accent-accent"
                />
                Cabecera institucional
              </label>
            </div>
          </div>
        )}
      </div>

      {catalogo && gruposVisibles.length === 0 && (
        <p className="text-sm text-text-dim">
          {soloActivos
            ? 'No hay activos vigentes para etiquetar.'
            : 'No hay activos en el catálogo de esta organización.'}
        </p>
      )}

      {/* Vista de Etiquetas (Simulada o Cuadrícula) */}
      <div
        className={
          vistaHoja
            ? 'mx-auto max-w-4xl rounded-2xl border border-neutral-300 bg-white p-8 text-black shadow-2xl'
            : 'space-y-10'
        }
      >
        {gruposVisibles.map((grupo) => (
          <section
            key={grupo.direccion}
            className="grupo-direccion direccion space-y-6"
          >
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text print:text-black">
                {grupo.direccion}{' '}
                <span className="text-sm font-normal text-text-dim print:text-neutral-600">
                  — {grupo.total} {grupo.total === 1 ? 'activo' : 'activos'}
                </span>
              </h2>
              <span className="text-xs font-mono text-text-dim print:hidden">
                {plantilla.toUpperCase()}
              </span>
            </div>

            {grupo.areas.map((area) => (
              <div key={area.areaNombre} className="grupo-area space-y-3">
                <h3 className="text-xs font-semibold text-text-dim print:text-neutral-700 tracking-wide uppercase">
                  Área: {area.areaNombre} ({area.activos.length})
                </h3>

                <div
                  className={`lista-etiquetas ${
                    plantilla === 'avery'
                      ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
                      : plantilla === 'tarjeta'
                        ? 'grid gap-4 sm:grid-cols-2'
                        : 'grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                  }`}
                >
                  {area.activos.map((etiqueta) => {
                    const qr = qrPorId.get(etiqueta.id);
                    if (!qr) return null;
                    return (
                      <EtiquetaActivo
                        key={etiqueta.id}
                        etiqueta={etiqueta}
                        qrDataUrl={qr}
                        plantilla={plantilla}
                        mostrarBarcode={mostrarBarcode}
                        mostrarInstitucion={mostrarInstitucion}
                        nombreOrganizacion="SICSAFT PATRIMONIO"
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { cisClient, type DocumentoActivo } from '@/lib/cis-client';
import { Alert, Button } from '@/components/ui';
import { IconSparkles } from '@/components/icons';

// Módulos desacoplados según principios de Clean Architecture y SOLID
import type { ActivoFilaAft, SeccionCip } from './cip/types';
import { useCipData } from './cip/use-cip-data';
import { CipSidebar } from './cip/components/CipSidebar';
import { CipHeader } from './cip/components/CipHeader';
import { CipKpiCards } from './cip/components/CipKpiCards';
import { CipDonutChart, CipBarChart, CipValorMatrix } from './cip/components/CipCharts';
import { CipActivosTable } from './cip/components/CipActivosTable';
import { CipFichaModal } from './cip/components/CipFichaModal';

export function CipPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  // Estado de navegación
  const [seccionActiva, setSeccionActiva] = useState<SeccionCip>('resumen');

  // Hook centralizado con lógica de negocio y datos
  const {
    cargando,
    error,
    areasReales,
    filasFiltradas,
    kpis,
    datosCategorias,
    segmentosDonut,
    datosEstadosBarra,
    filtros,
    cargarDatos,
    exportarCsv,
  } = useCipData(organizacionId);

  // Estados de visualización de Ficha Técnica (Solo Consulta)
  const [fichaActivo, setFichaActivo] = useState<ActivoFilaAft | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoActivo[] | null>(null);
  const [cargandoDocs, setCargandoDocs] = useState(false);

  // Abrir expediente técnico de solo lectura
  async function handleAbrirFicha(activo: ActivoFilaAft) {
    setFichaActivo(activo);

    try {
      const url = await QRCode.toDataURL(activo.codigoQr, {
        width: 280,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl(null);
    }

    if (activo.id) {
      setCargandoDocs(true);
      try {
        const docs = await cisClient.getDocumentosActivo(activo.id, organizacionId);
        setDocumentos(docs);
      } catch {
        setDocumentos([]);
      } finally {
        setCargandoDocs(false);
      }
    } else {
      setDocumentos([]);
    }
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {/* 1. Sidebar Modular */}
      <CipSidebar
        seccionActiva={seccionActiva}
        onSeleccionarSeccion={(sec) => {
          setSeccionActiva(sec);
          setFichaActivo(null);
        }}
        organizacionId={organizacionId}
      />

      {/* 2. Contenedor Principal Fluido */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Topbar Institucional */}
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg-raised/95 px-6 shadow-elev-1 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-[0.2em] text-accent-strong uppercase lg:hidden">
              SICSAFT CIP
            </span>
            <span className="hidden text-xs font-semibold text-text-dim uppercase tracking-wider lg:block">
              Centro de Inteligencia Patrimonial
            </span>
          </div>
          <div className="flex items-center gap-3">
            {organizacionId && (
              <a
                href={`/dashboard?organizacionId=${encodeURIComponent(organizacionId)}`}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-dim hover:bg-bg-card hover:text-text transition-colors"
              >
                <span>← Volver a CCP</span>
              </a>
            )}
            <Button
              variant="secondary"
              onClick={() => window.print()}
              className="text-xs py-1.5 px-3"
            >
              Imprimir
            </Button>
          </div>
        </header>

        {/* Cuerpo de la Página */}
        <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-12">
          {/* Header & Barra de Filtros */}
          <CipHeader
            seccionActiva={seccionActiva}
            terminoBusqueda={filtros.terminoBusqueda}
            onCambiarBusqueda={filtros.setTerminoBusqueda}
            areaFiltro={filtros.areaFiltro}
            onCambiarAreaFiltro={filtros.setAreaFiltro}
            areasReales={areasReales}
            cargando={cargando}
            onActualizar={cargarDatos}
            onExportarCsv={exportarCsv}
            mostrarValorMatriz={filtros.mostrarValorMatriz}
            onToggleValorMatriz={() => filtros.setMostrarValorMatriz(!filtros.mostrarValorMatriz)}
          />

          {error && <Alert variant="error">{error}</Alert>}

          {/* Expediente Técnico (Ficha de Solo Consulta) */}
          {fichaActivo && (
            <CipFichaModal
              activo={fichaActivo}
              qrDataUrl={qrDataUrl}
              documentos={documentos}
              cargandoDocs={cargandoDocs}
              onCerrar={() => setFichaActivo(null)}
            />
          )}

          {/* VISTA 1: RESUMEN EJECUTIVO (BI ANALYTICS) */}
          {seccionActiva === 'resumen' && (
            <>
              <CipKpiCards kpis={kpis} modo="resumen" />

              {filtros.mostrarValorMatriz && (
                <CipValorMatrix
                  valorTotalBruto={kpis.valorTotalBruto}
                  valorTotalNeto={kpis.valorTotalNeto}
                />
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CipDonutChart
                  totalActivos={kpis.totalActivos}
                  datosCategorias={datosCategorias}
                  segmentosDonut={segmentosDonut}
                  categoriaSeleccionada={filtros.categoriaSeleccionada}
                  onSeleccionarCategoria={filtros.setCategoriaSeleccionada}
                />

                <CipBarChart datosEstadosBarra={datosEstadosBarra} />
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-bold text-text">Muestreo de Activos Recientes</h2>
                <CipActivosTable
                  filas={filasFiltradas}
                  activoSeleccionadoId={fichaActivo?.codigoQr}
                  onSeleccionarActivo={handleAbrirFicha}
                  esVistaResumen={true}
                />
              </div>
            </>
          )}

          {/* VISTA 2: CATÁLOGO COMPLETO DE ACTIVOS (AFT) */}
          {seccionActiva === 'activos' && (
            <div className="space-y-4">
              <CipKpiCards kpis={kpis} modo="catalogo" />

              <CipActivosTable
                filas={filasFiltradas}
                activoSeleccionadoId={fichaActivo?.codigoQr}
                onSeleccionarActivo={handleAbrirFicha}
                esVistaResumen={false}
              />
            </div>
          )}

          {/* VISTA 3: OTRAS SECCIONES EN PREPARACIÓN */}
          {seccionActiva !== 'resumen' && seccionActiva !== 'activos' && (
            <div className="rounded-xl border border-border bg-bg-card p-10 text-center space-y-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent-strong mx-auto">
                <IconSparkles className="h-5 w-5" />
              </span>
              <h2 className="text-base font-bold text-text capitalize">
                Módulo de {seccionActiva}
              </h2>
              <p className="text-xs text-text-dim max-w-sm mx-auto">
                Panel de analítica y consulta para {seccionActiva}.
              </p>
              <div className="pt-1">
                <Button variant="secondary" onClick={() => setSeccionActiva('resumen')}>
                  Volver al Resumen
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

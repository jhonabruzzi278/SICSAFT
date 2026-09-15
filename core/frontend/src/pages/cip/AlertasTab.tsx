import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  dashboardClient,
  type ActivoFueraDeArea,
} from '@/lib/dashboard-client';
import { cisClient, type ActivoCatalogo } from '@/lib/cis-client';
import { Alert, Badge, Button, Card } from '@/components/ui';
import { IconRefresh } from '@/components/icons';

// Hub de alertas del CIP — DOC-026 8 lo dejaba explícitamente fuera de alcance ("Motor de
// Alertas, sin consumidor real todavía"): el dato ya existía (CIP ACTIVO_FUERA_DE_AREA,
// agregacion.service.ts upsertFueraDeArea) y el cliente hacia CIS/CIP también
// (dashboardClient.getFueraDeArea), pero nada en la UI lo mostraba. Esta pestaña es ese primer
// consumidor: por cada AFT que apareció fuera de su área durante un control (app-qr-sicsaft,
// resultado 'otra_area'/'otra_ubicacion'), señala dónde se lo encontró en el momento del control
// y dónde debería estar según el catálogo que administra el Profesional de AFT (CCP).
//
// DOC-034 Parte A (2026-09-15) — cada alerta ahora viaja entrelazada a la sesión/reporte que la
// generó (`sesionId`/`veredicto`, calculados una sola vez en CIP al cerrar la sesión, nunca
// recalculados acá) — mismo badge de veredicto que ResumenTab.tsx y un link directo al reporte
// completo (Pantalla 8) de esa sesión en Controles de área.
function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CL');
}

const VARIANTE_VEREDICTO: Record<string, 'success' | 'warning' | 'error'> = {
  exitoso: 'success',
  aceptable: 'warning',
  defectuoso: 'error',
};

const ETIQUETA_VEREDICTO: Record<string, string> = {
  exitoso: 'Exitoso',
  aceptable: 'Aceptable',
  defectuoso: 'Defectuoso',
};

export function AlertasTab() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<ActivoFueraDeArea[]>([]);
  const [catalogo, setCatalogo] = useState<ActivoCatalogo[]>([]);

  const cargarDatos = useCallback(async () => {
    if (!organizacionId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const [fueraDeAreaRes, catalogoRes] = await Promise.allSettled([
        dashboardClient.getFueraDeArea(organizacionId),
        cisClient.getCatalogo(organizacionId),
      ]);

      if (fueraDeAreaRes.status === 'fulfilled') {
        setAlertas(fueraDeAreaRes.value.items);
      } else {
        setError(
          fueraDeAreaRes.reason instanceof Error
            ? fueraDeAreaRes.reason.message
            : 'Error al sincronizar con CIP',
        );
      }
      if (catalogoRes.status === 'fulfilled') setCatalogo(catalogoRes.value);
    } finally {
      setCargando(false);
    }
  }, [organizacionId]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  // CIP solo conoce IDs de área (agregacion.service.ts no depende del catálogo de CORE, ver
  // ARCHITECTURE.md 5) — el nombre lo resolvemos acá con el mismo catálogo de CORE que ya usa
  // ResumenTab/ActivosTab para el mismo problema (ver cis-client.ts "el nombre de las areas...").
  const nombrePorArea = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const activo of catalogo) {
      if (activo.areaId && !mapa.has(activo.areaId)) {
        mapa.set(activo.areaId, activo.areaNombre || activo.areaId);
      }
    }
    return mapa;
  }, [catalogo]);

  const porCodigoQr = useMemo(() => {
    const mapa = new Map<string, ActivoCatalogo>();
    for (const activo of catalogo) mapa.set(activo.codigoQr, activo);
    return mapa;
  }, [catalogo]);

  function nombreDeArea(areaId: string): string {
    return nombrePorArea.get(areaId) ?? areaId;
  }

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Alertas — AFT fuera de lugar
          </h1>
          <p className="mt-0.5 text-sm text-text-dim">
            AFT detectados en una acción de control fuera del área a la que
            pertenecen según el catálogo del Profesional de AFT.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={cargarDatos}
          disabled={cargando}
          className="gap-1.5 px-3 py-1.5 text-xs"
          title="Sincronizar alertas con CIP"
        >
          <IconRefresh className={cargando ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!error && cargando && <p className="text-text-dim">Cargando alertas…</p>}

      {!cargando && !error && alertas.length === 0 && (
        <Card>
          <p className="text-sm text-text-dim">
            Sin AFT fuera de lugar detectados — todos los controles recientes
            coinciden con el área registrada en el catálogo.
          </p>
        </Card>
      )}

      {alertas.length > 0 && (
        <div className="space-y-3">
          {alertas.map((alerta) => {
            const activo = porCodigoQr.get(alerta.codigoQr);
            return (
              <div
                key={`${alerta.sesionId}-${alerta.codigoQr}`}
                className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">AFT fuera de lugar</Badge>
                    <Badge variant={VARIANTE_VEREDICTO[alerta.veredicto]}>
                      Sesión{' '}
                      {ETIQUETA_VEREDICTO[alerta.veredicto] ?? alerta.veredicto}
                    </Badge>
                    <span className="font-mono text-xs text-text-dim">
                      {alerta.codigoQr}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-text">
                    {activo?.nombre ?? 'AFT no encontrado en el catálogo'}
                  </p>
                  <p className="mt-0.5 text-xs text-text-faint">
                    Detectado el {formatFecha(alerta.detectadoEn)}
                  </p>
                  <Link
                    to={`/dashboard/controles-area?organizacionId=${encodeURIComponent(organizacionId)}&sesionId=${encodeURIComponent(alerta.sesionId)}`}
                    className="mt-1 inline-block text-xs font-semibold text-accent hover:underline"
                  >
                    Ver reporte completo →
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:text-right">
                  <div>
                    <p className="text-xs text-text-dim">
                      Está en (al momento del control)
                    </p>
                    <p className="font-medium text-destructive">
                      {nombreDeArea(alerta.areaRealId)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-dim">
                      Debería estar en (BD del Profesional de AFT)
                    </p>
                    <p className="font-medium text-text">
                      {activo?.areaNombre ??
                        nombreDeArea(alerta.areaEsperadaId)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

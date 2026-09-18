import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  dashboardClient,
  type ActivoFueraDeArea,
} from '@/lib/dashboard-client';
import { cisClient, type Area, type ActivoCatalogo } from '@/lib/cis-client';
import { Alert, Badge, Button, Card } from '@/components/ui';
import { IconMapPin, IconRefresh } from '@/components/icons';

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
  const [areas, setAreas] = useState<Area[]>([]);

  const cargarDatos = useCallback(async () => {
    if (!organizacionId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const [fueraDeAreaRes, catalogoRes, areasRes] = await Promise.allSettled([
        dashboardClient.getFueraDeArea(organizacionId),
        cisClient.getCatalogo(organizacionId),
        cisClient.getAreas(organizacionId),
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
      if (areasRes.status === 'fulfilled') setAreas(areasRes.value);
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

  const areaPorId = useMemo(() => {
    const mapa = new Map<string, Area>();
    for (const area of areas) mapa.set(area.id, area);
    return mapa;
  }, [areas]);

  // "Cambia DC-38 por la dirección en la que se estaba haciendo el control — es lo más
  // importante" (pedido del usuario 2026-09-16): la jerarquía Dirección → Departamento del área
  // donde se realizó la acción de control (`areaRealId`, no `areaEsperadaId`) le importa más al
  // Directivo que el código QR puntual del AFT, sobre todo si un lugar acumula muchas alertas.
  function jerarquiaDeArea(areaId: string): string {
    const area = areaPorId.get(areaId);
    if (!area) return nombreDeArea(areaId);
    const partes = [area.dependencia, area.departamento].filter(
      (v): v is string => Boolean(v?.trim()),
    );
    return partes.length > 0 ? partes.join(' · ') : area.nombre;
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
            // "Fuera de área" es en sí siempre nivel alerta, pero si la SESIÓN que la generó fue
            // Defectuoso, toda la tarjeta se pinta de rojo — no solo el badge "Sesión …" chico
            // (bug real reportado por el usuario: la tarjeta quedaba ámbar aunque la sesión fuera
            // defectuosa, con un único pill rojo perdido adentro).
            const esDefectuoso = alerta.veredicto === 'defectuoso';
            return (
              <div
                key={`${alerta.sesionId}-${alerta.codigoQr}`}
                className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-start ${
                  esDefectuoso
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-warning/30 bg-warning/5'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    esDefectuoso
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-warning/15 text-warning'
                  }`}
                >
                  <IconMapPin width={17} height={17} />
                </span>
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning">AFT fuera de lugar</Badge>
                      <Badge variant={VARIANTE_VEREDICTO[alerta.veredicto]}>
                        Sesión{' '}
                        {ETIQUETA_VEREDICTO[alerta.veredicto] ??
                          alerta.veredicto}
                      </Badge>
                    </div>
                    {/* Lo más importante para el Directivo es DÓNDE se hizo el control, no el
                        código puntual del AFT — sobre todo si un área acumula muchas alertas y
                        el nombre completo de cada AFT (antes acá) se vuelve una lista larga. El
                        codigoQr sigue disponible, pero chico y al lado de "Ver reporte". */}
                    <p className="mt-1 text-sm font-bold text-text">
                      {jerarquiaDeArea(alerta.areaRealId)}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-accent">
                      Detectado el {formatFecha(alerta.detectadoEn)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Link
                        to={`/dashboard/controles-area/reporte/${encodeURIComponent(alerta.sesionId)}?organizacionId=${encodeURIComponent(organizacionId)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent-strong transition-colors hover:bg-accent/20"
                      >
                        Ver reporte completo →
                      </Link>
                      <span className="font-mono text-[0.65rem] text-text-faint">
                        {alerta.codigoQr}
                      </span>
                    </div>
                  </div>
                  {/* Resumen del traslado en una sola línea — antes eran 2 bloques con
                      explicaciones largas ("al momento del control"/"BD del Profesional de
                      AFT") que ya se entienden por contexto una vez adentro de "Alertas". */}
                  <div className="flex items-center gap-2 text-sm sm:text-right">
                    <div>
                      <p className="text-[0.65rem] text-text-dim">
                        Encontrado en
                      </p>
                      <p
                        className={`font-semibold ${esDefectuoso ? 'text-destructive' : 'text-warning'}`}
                      >
                        {nombreDeArea(alerta.areaRealId)}
                      </p>
                    </div>
                    <span className="text-text-faint" aria-hidden="true">
                      →
                    </span>
                    <div>
                      <p className="text-[0.65rem] text-text-dim">
                        Pertenece a
                      </p>
                      <p className="font-medium text-text">
                        {activo?.areaNombre ??
                          nombreDeArea(alerta.areaEsperadaId)}
                      </p>
                    </div>
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

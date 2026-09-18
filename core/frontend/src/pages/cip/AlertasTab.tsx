import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { dashboardClient } from '@/lib/dashboard-client';
import { cisClient, type Area } from '@/lib/cis-client';
import {
  formatDetectadoEn,
  sesionesConAlarma,
  type SesionVeredicto,
} from '@/lib/alarmas';
import { Alert, Button, Card } from '@/components/ui';
import { IconRefresh } from '@/components/icons';

// Hub de alarmas del CIP.
//
// DOC-037 (2026-09-17) — la pestaña dejó de listar "AFT fuera de lugar" (un AFT encontrado en otra
// área) y pasa a listar **AFT extraviados**: los que el control no encontró, que es lo que el
// resto del sistema ya llama "extraviados" (ver PantallaControlArea LISTAS_TABS). Solo se muestran
// los de acciones de control **defectuosas**, y una sola alarma por Área — el Directivo mira DÓNDE
// falló el control, no el código puntual de cada AFT.
//
// La regla de alta y baja vive en lib/alarmas.ts y es derivada, nunca persistida: no hay botón de
// descarte a propósito. Ver el comentario de ese archivo.

interface AlarmaExtravio {
  sesion: SesionVeredicto;
  direccion: string;
  area: string;
  extraviados: number;
}

const SIN_DIRECCION = 'Sin dirección';

export function AlertasTab() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sesiones, setSesiones] = useState<SesionVeredicto[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [extraviadosPorSesion, setExtraviadosPorSesion] = useState<
    Map<string, number>
  >(new Map());

  const cargarDatos = useCallback(async () => {
    if (!organizacionId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const [sesionesRes, areasRes] = await Promise.allSettled([
        dashboardClient.getTodasLasSesiones(organizacionId),
        cisClient.getAreas(organizacionId),
      ]);

      if (areasRes.status === 'fulfilled') setAreas(areasRes.value);
      if (sesionesRes.status !== 'fulfilled') {
        setError(
          sesionesRes.reason instanceof Error
            ? sesionesRes.reason.message
            : 'Error al sincronizar con CIP',
        );
        return;
      }
      setSesiones(sesionesRes.value);

      // Cuántos AFT extraviados dejó cada control con alarma. Se consulta solo por las sesiones
      // que ya pasaron el filtro (último control del área + defectuoso), que son pocas — no por
      // todo el registro.
      const candidatas = sesionesConAlarma(sesionesRes.value);
      const resumenes = await Promise.allSettled(
        candidatas.map((s) =>
          cisClient.getInventarioResumenControl(s.sesionId),
        ),
      );
      const conteo = new Map<string, number>();
      candidatas.forEach((s, i) => {
        const r = resumenes[i];
        if (r.status === 'fulfilled') {
          conteo.set(s.sesionId, r.value.faltantes.length);
        }
      });
      setExtraviadosPorSesion(conteo);
    } finally {
      setCargando(false);
    }
  }, [organizacionId]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const areaPorId = useMemo(() => {
    const mapa = new Map<string, Area>();
    for (const area of areas) mapa.set(area.id, area);
    return mapa;
  }, [areas]);

  // Solo quedan las alarmas cuyo control efectivamente dejó AFT extraviados: un control
  // defectuoso sin extraviados no es un extravío, es otra clase de hallazgo.
  const alarmas = useMemo<AlarmaExtravio[]>(() => {
    return sesionesConAlarma(sesiones)
      .map((sesion) => {
        const area = areaPorId.get(sesion.areaId);
        return {
          sesion,
          direccion: area?.dependencia?.trim() || SIN_DIRECCION,
          area: area?.nombre ?? sesion.areaId,
          extraviados: extraviadosPorSesion.get(sesion.sesionId) ?? 0,
        };
      })
      .filter((alarma) => alarma.extraviados > 0);
  }, [sesiones, areaPorId, extraviadosPorSesion]);

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
            Alarmas
          </h1>
          <p className="mt-0.5 text-sm text-text-dim">
            Áreas cuyo último control cerró con proceso deficiente y dejó AFT
            sin encontrar. La alarma se baja registrando un control nuevo con
            proceso Excelente en la misma Dirección y Área.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={cargarDatos}
          disabled={cargando}
          className="gap-1.5 px-3 py-1.5 text-xs"
          title="Sincronizar alarmas con CIP"
        >
          <IconRefresh className={cargando ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!error && cargando && <p className="text-text-dim">Cargando alarmas…</p>}

      {!cargando && !error && alarmas.length === 0 && (
        <Card>
          <p className="text-sm text-text-dim">
            Sin alarmas activas — ningún área quedó con AFT extraviados en su
            último control.
          </p>
        </Card>
      )}

      {alarmas.length > 0 && (
        <ul className="space-y-3">
          {alarmas.map((alarma) => (
            <li
              key={alarma.sesion.sesionId}
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-destructive">
                    AFT Extraviado en acción de control
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-medium text-text">
                      {alarma.direccion}
                    </span>
                    <span className="text-sm text-text-dim">{alarma.area}</span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-destructive">
                    Detectado el {formatDetectadoEn(alarma.sesion.fechaCierre)}
                  </p>
                </div>
                <Link
                  to={`/dashboard/controles-area/reporte/${encodeURIComponent(alarma.sesion.sesionId)}?organizacionId=${encodeURIComponent(organizacionId)}`}
                  className="shrink-0 rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-bg transition-opacity hover:opacity-90"
                >
                  Ver reporte completo →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

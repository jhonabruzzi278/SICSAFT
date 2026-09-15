import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cisClient,
  type SesionInventario,
  type SesionInventarioDetalle,
} from '@/lib/cis-client';
import { Alert, Badge, Button, Card } from '@/components/ui';
import { PantallaControlArea } from '@/components/PantallaControlArea';
import { HistorialSesiones } from './HistorialSesiones';

// Fase 4 (reestructuracion CCP/CIP, 2026-09-13) — portado de ccp/src/pages/InventariosPage.tsx:
// mismo componente, mismo contrato con CIS (GET /inventarios*), solo reconectado al cis-client.ts
// de este portal. Pantalla de solo lectura — sin escrituras propias, sin cambios de guard.
// RF-04 / DOC-029 RF-I — Módulo de Controles de Área: muestra las sesiones enviadas desde la APK
// móvil en terreno y permite al Directivo/Profesional AFT contrastar los escaneos contra la base
// de datos oficial BPI (Pantalla 8 / Control de Área).

// Fase 3.1 — lo que el controlador declaró por ese AFT durante el control (no confundir con el
// resultado del escaneo en sí, que es `resultado`). 'activo' no se muestra: es el caso sin
// anomalía, no aporta nada resaltarlo fila por fila.
const ESTADO_DECLARADO_LABEL: Record<'mantenimiento' | 'inactivo', string> = {
  mantenimiento: 'No funciona',
  inactivo: 'Fuera de servicio',
};

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL');
}

export function ControlesAreaTab() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [sesiones, setSesiones] = useState<SesionInventario[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<SesionInventarioDetalle | null>(null);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const [vistaDetalle, setVistaDetalle] = useState<
    'control' | 'escaneos' | 'historial'
  >('control');

  // DOC-034 Parte A — el link "Ver reporte completo" de Alertas llega acá con `?sesionId=` para
  // abrir directo esa sesión en vez de la primera de la lista.
  const sesionIdDesdeUrl = searchParams.get('sesionId');

  useEffect(() => {
    let cancelled = false;
    setSesiones(null);
    setSeleccionId(null);
    setDetalle(null);
    setDetalleError(null);
    setVistaDetalle('control');
    if (!organizacionId) return;
    setListError(null);
    cisClient
      .getInventarios(organizacionId)
      .then((data) => {
        if (cancelled) return;
        setSesiones(data);
        const coincide = sesionIdDesdeUrl
          ? data.find((s) => s.id === sesionIdDesdeUrl)
          : undefined;
        if (coincide) {
          setSeleccionId(coincide.id);
        } else if (data.length > 0) {
          setSeleccionId(data[0].id);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setListError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, [organizacionId, sesionIdDesdeUrl]);

  useEffect(() => {
    if (!seleccionId) return;
    let cancelled = false;
    setDetalle(null);
    setDetalleError(null);
    cisClient
      .getInventarioDetalle(seleccionId)
      .then((data) => {
        if (!cancelled) setDetalle(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDetalleError(
          err instanceof Error ? err.message : 'Error desconocido',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [seleccionId]);

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-accent-strong">
          Controles de Área y Contrastación BPI
        </h1>
        <p className="mt-1 text-sm text-text-dim">
          Recepción y supervisión de sesiones de relevamiento en terreno
          enviadas desde la App Móvil QR.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          {listError && <Alert>{listError}</Alert>}
          {!listError && !sesiones && (
            <p className="text-text-dim">Cargando sesiones…</p>
          )}
          {sesiones?.length === 0 && (
            <p className="text-text-dim">Sin sesiones de inventario todavía.</p>
          )}
          {sesiones && sesiones.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border bg-bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-raised text-text-dim">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cierre</th>
                    <th className="px-4 py-3 font-medium">Área</th>
                    <th className="px-4 py-3 font-medium">Ubicación</th>
                    <th className="px-4 py-3 font-medium">Operador</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sesiones.map((sesion) => (
                    <tr
                      key={sesion.id}
                      className={`border-t border-border transition-colors hover:bg-bg-raised ${
                        seleccionId === sesion.id
                          ? 'bg-accent/10 border-l-4 border-l-accent'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        {formatFechaHora(sesion.fechaCierre)}
                      </td>
                      <td className="px-4 py-3 text-text-dim">
                        {sesion.areaId}
                      </td>
                      <td className="px-4 py-3 text-text-dim">
                        {sesion.ubicacionId}
                      </td>
                      <td className="px-4 py-3 text-text-dim">
                        {sesion.operadorId}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-label={`Ver sesión del ${formatFechaHora(sesion.fechaCierre)}`}
                          aria-pressed={seleccionId === sesion.id}
                          onClick={() => setSeleccionId(sesion.id)}
                          className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Badge>{sesion.estado}</Badge>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          {!seleccionId && (
            <Card>
              <p className="text-sm text-text-dim">
                Elegí una sesión de la lista para ver el reporte de
                contrastación.
              </p>
            </Card>
          )}

          {seleccionId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex gap-2">
                  <Button
                    variant={
                      vistaDetalle === 'control' ? 'primary' : 'secondary'
                    }
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setVistaDetalle('control')}
                  >
                    Control BPI (Pantalla 8)
                  </Button>
                  <Button
                    variant={
                      vistaDetalle === 'escaneos' ? 'primary' : 'secondary'
                    }
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setVistaDetalle('escaneos')}
                  >
                    Escaneos ({detalle?.escaneos?.length ?? 0})
                  </Button>
                  <Button
                    variant={
                      vistaDetalle === 'historial' ? 'primary' : 'secondary'
                    }
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setVistaDetalle('historial')}
                  >
                    Historial
                  </Button>
                </div>
              </div>

              {vistaDetalle === 'control' && (
                <PantallaControlArea sesionId={seleccionId} />
              )}
              {vistaDetalle === 'historial' && (
                <HistorialSesiones organizacionId={organizacionId} />
              )}
              {vistaDetalle === 'escaneos' && (
                <Card className="h-fit">
                  <h2 className="mb-4 font-medium text-text">
                    Listado de Escaneos
                  </h2>
                  {detalleError && <Alert>{detalleError}</Alert>}
                  {!detalle && !detalleError && (
                    <p className="text-sm text-text-dim">Cargando escaneos…</p>
                  )}
                  {detalle && (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-2 text-xs border-b border-border pb-3">
                        <div>
                          <dt className="text-text-dim">Inicio</dt>
                          <dd className="font-medium">
                            {formatFechaHora(detalle.fechaInicio)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-text-dim">Cierre</dt>
                          <dd className="font-medium">
                            {formatFechaHora(detalle.fechaCierre)}
                          </dd>
                        </div>
                      </dl>
                      <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {detalle.escaneos.map((escaneo) => (
                          <li
                            key={escaneo.codigoQr}
                            className="flex flex-col gap-1 rounded-lg border border-border bg-bg-card px-3 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono">
                                {escaneo.codigoQr}
                              </span>
                              <Badge>{escaneo.resultado}</Badge>
                            </div>
                            {escaneo.estadoDeclarado &&
                              escaneo.estadoDeclarado !== 'activo' && (
                                <div>
                                  <Badge variant="warning">
                                    Declarado:{' '}
                                    {
                                      ESTADO_DECLARADO_LABEL[
                                        escaneo.estadoDeclarado
                                      ]
                                    }
                                  </Badge>
                                </div>
                              )}
                            {escaneo.bajaSugeridaMotivo && (
                              <p className="text-destructive">
                                Baja sugerida: {escaneo.bajaSugeridaMotivo}
                              </p>
                            )}
                            {escaneo.observaciones && (
                              <p className="text-text-dim">
                                {escaneo.observaciones}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

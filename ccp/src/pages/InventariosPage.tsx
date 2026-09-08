import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cisClient,
  type SesionInventario,
  type SesionInventarioDetalle,
} from '@/lib/cis-client';
import { Alert, Badge, Button, Card } from '@/components/ui';
import { PantallaControlArea } from '@/components/PantallaControlArea';

// RF-04 / DOC-029 RF-I — Módulo de Inventarios y Contrastación BPI:
// Muestra las sesiones enviadas desde la APK móvil en terreno y permite al Profesional AFT
// contrastar los escaneos contra la base de datos oficial BPI (Pantalla 8 / Control de Área).

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL');
}

export function InventariosPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [sesiones, setSesiones] = useState<SesionInventario[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<SesionInventarioDetalle | null>(null);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const [vistaDetalle, setVistaDetalle] = useState<'control' | 'escaneos'>('control');

  useEffect(() => {
    if (!organizacionId) return;
    setListError(null);
    cisClient
      .getInventarios(organizacionId)
      .then((data) => {
        setSesiones(data);
        if (data.length > 0 && !seleccionId) {
          setSeleccionId(data[0].id);
        }
      })
      .catch((err: unknown) => {
        setListError(err instanceof Error ? err.message : 'Error desconocido');
      });
  }, [organizacionId]);

  useEffect(() => {
    if (!seleccionId) return;
    setDetalle(null);
    setDetalleError(null);
    cisClient
      .getInventarioDetalle(seleccionId)
      .then(setDetalle)
      .catch((err: unknown) => {
        setDetalleError(
          err instanceof Error ? err.message : 'Error desconocido',
        );
      });
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
          Inventarios y Contrastación BPI
        </h1>
        <p className="mt-1 text-sm text-text-dim">
          Recepción y supervisión de sesiones de relevamiento en terreno enviadas desde la App Móvil QR.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          {listError && <Alert>{listError}</Alert>}
          {!listError && !sesiones && <p className="text-text-dim">Cargando sesiones…</p>}
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
                      onClick={() => setSeleccionId(sesion.id)}
                      className={`cursor-pointer border-t border-border transition-colors hover:bg-bg-raised ${
                        seleccionId === sesion.id ? 'bg-accent/10 border-l-4 border-l-accent' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        {formatFechaHora(sesion.fechaCierre)}
                      </td>
                      <td className="px-4 py-3 text-text-dim">{sesion.areaId}</td>
                      <td className="px-4 py-3 text-text-dim">{sesion.ubicacionId}</td>
                      <td className="px-4 py-3 text-text-dim">{sesion.operadorId}</td>
                      <td className="px-4 py-3">
                        <Badge>{sesion.estado}</Badge>
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
              <p className="text-sm text-text-dim">Elegí una sesión de la lista para ver el reporte de contrastación.</p>
            </Card>
          )}

          {seleccionId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex gap-2">
                  <Button
                    variant={vistaDetalle === 'control' ? 'primary' : 'secondary'}
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setVistaDetalle('control')}
                  >
                    Control BPI (Pantalla 8)
                  </Button>
                  <Button
                    variant={vistaDetalle === 'escaneos' ? 'primary' : 'secondary'}
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setVistaDetalle('escaneos')}
                  >
                    Escaneos ({detalle?.escaneos?.length ?? 0})
                  </Button>
                </div>
              </div>

              {vistaDetalle === 'control' ? (
                <PantallaControlArea sesionId={seleccionId} />
              ) : (
                <Card className="h-fit">
                  <h2 className="mb-4 font-medium text-text">Listado de Escaneos</h2>
                  {detalleError && <Alert>{detalleError}</Alert>}
                  {!detalle && !detalleError && (
                    <p className="text-sm text-text-dim">Cargando escaneos…</p>
                  )}
                  {detalle && (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-2 text-xs border-b border-border pb-3">
                        <div>
                          <dt className="text-text-dim">Inicio</dt>
                          <dd className="font-medium">{formatFechaHora(detalle.fechaInicio)}</dd>
                        </div>
                        <div>
                          <dt className="text-text-dim">Cierre</dt>
                          <dd className="font-medium">{formatFechaHora(detalle.fechaCierre)}</dd>
                        </div>
                      </dl>
                      <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {detalle.escaneos.map((escaneo) => (
                          <li
                            key={escaneo.codigoQr}
                            className="flex items-center justify-between rounded-lg border border-border bg-bg-card px-3 py-2 text-xs"
                          >
                            <span className="font-mono">{escaneo.codigoQr}</span>
                            <Badge>{escaneo.resultado}</Badge>
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

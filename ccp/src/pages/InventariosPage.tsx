import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cisClient,
  type SesionInventario,
  type SesionInventarioDetalle,
} from '@/lib/cis-client';
import { Alert, Badge, Card } from '@/components/ui';

// RF-04 — módulo Inventarios: solo lectura (estado y detalle de sesiones, DOC-006 3/4). Sin
// escritura acá — las sesiones se crean desde APP QR (`POST /inventarios`), WEB solo las
// consulta. Lista a la izquierda + detalle (escaneos) a la derecha al hacer click en una fila.

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

  useEffect(() => {
    if (!organizacionId) return;
    setListError(null);
    cisClient
      .getInventarios(organizacionId)
      .then(setSesiones)
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
        setDetalleError(err instanceof Error ? err.message : 'Error desconocido');
      });
  }, [seleccionId]);

  if (!organizacionId) {
    return <Alert>Falta organizacionId — volvé al hub y elegí una organización.</Alert>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-accent-strong">Inventarios</h1>
        {listError && <Alert>{listError}</Alert>}
        {!listError && !sesiones && <p className="text-text-dim">Cargando…</p>}
        {sesiones?.length === 0 && (
          <p className="text-text-dim">Sin sesiones de inventario todavía.</p>
        )}
        {sesiones && sesiones.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Cierre</th>
                  <th className="px-4 py-2 font-medium">Área</th>
                  <th className="px-4 py-2 font-medium">Ubicación</th>
                  <th className="px-4 py-2 font-medium">Operador</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map((sesion) => (
                  <tr
                    key={sesion.id}
                    onClick={() => setSeleccionId(sesion.id)}
                    className={`cursor-pointer border-t border-border transition-colors hover:bg-bg-raised ${
                      seleccionId === sesion.id ? 'bg-bg-raised' : ''
                    }`}
                  >
                    <td className="px-4 py-2">{formatFechaHora(sesion.fechaCierre)}</td>
                    <td className="px-4 py-2">{sesion.areaId}</td>
                    <td className="px-4 py-2">{sesion.ubicacionId}</td>
                    <td className="px-4 py-2">{sesion.operadorId}</td>
                    <td className="px-4 py-2">
                      <Badge>{sesion.estado}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Card className="h-fit">
        <h2 className="mb-4 font-medium text-text">Detalle</h2>
        {!seleccionId && (
          <p className="text-sm text-text-dim">Elegí una sesión de la lista.</p>
        )}
        {seleccionId && detalleError && <Alert>{detalleError}</Alert>}
        {seleccionId && !detalle && !detalleError && (
          <p className="text-sm text-text-dim">Cargando…</p>
        )}
        {detalle && (
          <div>
            <dl className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-dim">Inicio</dt>
                <dd>{formatFechaHora(detalle.fechaInicio)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-dim">Cierre</dt>
                <dd>{formatFechaHora(detalle.fechaCierre)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-dim">Estado</dt>
                <dd>
                  <Badge>{detalle.estado}</Badge>
                </dd>
              </div>
            </dl>
            <p className="mb-2 text-sm font-medium text-text-dim">
              Escaneos ({detalle.escaneos.length})
            </p>
            <ul className="space-y-2">
              {detalle.escaneos.map((escaneo) => (
                <li
                  key={escaneo.codigoQr}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <span className="font-mono">{escaneo.codigoQr}</span>
                  <Badge>{escaneo.resultado}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

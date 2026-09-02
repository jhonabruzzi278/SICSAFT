import { useEffect, useState } from 'react';
import { cisClient, type ResumenControlArea } from '@/lib/cis-client';
import {
  estiloVeredicto,
  etiquetaTipo,
  formatPorcentaje,
} from '@/lib/pantalla-8';
import { Alert, Card } from '@/components/ui';

// DOC-029 RF-I — "Pantalla 8": informe de control de área de una sesión de relevamiento.
// Contrato exacto: casos-de-uso/CONTRATO-PANTALLA-8.md (título + encabezado + 6 bloques +
// veredicto con fondo de color). Misma vista que arma la APP QR al cerrar el control; acá se
// muestra en el Resumen del CCP al abrir una sesión. Los datos vienen de
// `GET /inventarios/:id/control` vía CIS — este componente no calcula nada.

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL');
}
function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Bloque({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-text">
        <span className="mr-2 text-text-faint">{numero}.</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function ListaAft({
  filas,
}: {
  filas: Array<{
    codigoQr: string;
    nombre: string | null;
    tipo: 'ordinario' | 'extraordinario' | null;
    areaRealNombre?: string | null;
  }>;
}) {
  if (filas.length === 0) {
    return <p className="text-sm text-text-dim">— ninguno —</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border text-sm">
      {filas.map((f) => (
        <li
          key={f.codigoQr}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
        >
          <span className="font-mono text-xs text-text-dim">{f.codigoQr}</span>
          <span className="min-w-0 flex-1 truncate text-text">
            {f.nombre ?? '(sin registrar)'}
          </span>
          <span className="text-[0.7rem] font-semibold tracking-wide text-text-faint">
            {etiquetaTipo(f.tipo)}
          </span>
          {f.areaRealNombre != null && (
            <span className="text-xs text-warning">
              pertenece a: {f.areaRealNombre}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PantallaControlArea({ sesionId }: { sesionId: string }) {
  const [resumen, setResumen] = useState<ResumenControlArea | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignorar = false;
    setResumen(null);
    setError(null);
    void (async () => {
      try {
        const res = await cisClient.getInventarioResumenControl(sesionId);
        if (!ignorar) setResumen(res);
      } catch (err: unknown) {
        if (!ignorar) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      }
    })();
    return () => {
      ignorar = true;
    };
  }, [sesionId]);

  if (error) return <Alert>{error}</Alert>;
  if (!resumen)
    return <p className="text-sm text-text-dim">Cargando la Pantalla 8…</p>;

  const est = resumen.porEstadoDeclarado;
  const veredicto = estiloVeredicto(resumen.veredicto);

  return (
    <Card className="space-y-6">
      <header>
        <h2 className="text-sm font-bold tracking-wide text-accent-strong uppercase">
          Resultados de acción de supervisión y control de AFT
        </h2>
        <p className="mt-1 text-xs text-text-dim">
          Área <span className="text-text">{resumen.areaId}</span> ·{' '}
          {fecha(resumen.fechaCierre)} · {hora(resumen.fechaCierre)}
        </p>
      </header>

      <Bloque numero={1} titulo="Cantidad de AFT escaneados">
        <p className="text-2xl font-semibold text-text">{resumen.escaneados}</p>
      </Bloque>

      <Bloque numero={2} titulo="AFT que pertenecen al área">
        <p className="text-sm text-text">
          <span className="text-2xl font-semibold">{resumen.delArea}</span> de{' '}
          {resumen.activosDelArea} registrados —{' '}
          <span className="font-semibold text-accent-strong">
            {formatPorcentaje(resumen.delAreaPct)}
          </span>
        </p>
      </Bloque>

      <Bloque
        numero={3}
        titulo="Estado de los AFT declarado por el controlador"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['EN SERVICIO', est.enServicio],
            ['EN MANTENIMIENTO', est.enMantenimiento],
            ['INACTIVO', est.inactivo],
            ['BAJA', est.baja],
          ].map(([label, n]) => (
            <div
              key={label}
              className="rounded-lg border border-border px-3 py-2 text-center"
            >
              <p className="text-xl font-semibold text-text">{n}</p>
              <p className="text-[0.65rem] font-medium tracking-wide text-text-faint">
                {label}
              </p>
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque numero={4} titulo="AFT escaneados">
        <ListaAft filas={resumen.escaneadosLista} />
      </Bloque>

      <Bloque
        numero={5}
        titulo={`AFT que NO corresponden al área (${resumen.fueraDeArea.length})`}
      >
        <ListaAft filas={resumen.fueraDeArea} />
      </Bloque>

      {resumen.faltantes.length > 0 && (
        <Bloque
          numero={6}
          titulo={`AFT del área que no se escanearon (${resumen.faltantes.length})`}
        >
          <ListaAft
            filas={resumen.faltantes.map((f) => ({ ...f, tipo: null }))}
          />
        </Bloque>
      )}

      <div className={`rounded-xl px-4 py-3 ${veredicto.fondo}`}>
        <p className="text-sm font-bold tracking-wide">
          Proceso {veredicto.etiqueta}
        </p>
        <p className="mt-0.5 text-xs opacity-90">{veredicto.detalle}</p>
      </div>
    </Card>
  );
}

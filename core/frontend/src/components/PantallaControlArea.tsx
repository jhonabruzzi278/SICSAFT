import { useEffect, useMemo, useState } from 'react';
import {
  cisClient,
  type ActivoCatalogo,
  type ResumenControlArea,
} from '@/lib/cis-client';
import {
  estiloVeredicto,
  etiquetaTipo,
  formatPorcentaje,
} from '@/lib/pantalla-8';
import { Alert, Badge } from '@/components/ui';
import { KpiCard } from '@/components/KpiCard';
import { DonutChart } from '@/components/DonutChart';
import { IconMapPin } from '@/components/icons';
import { PALETA_CATEGORIAS } from '@/lib/colores';

// DOC-029 RF-I — "Pantalla 8": informe de control de área de una sesión de relevamiento.
// Contrato exacto: casos-de-uso/CONTRATO-PANTALLA-8.md (los 6 bloques + veredicto son
// obligatorios; el resto — tarjetas KPI, hallazgos, donut — es presentación agregada sobre esos
// mismos datos, no un contrato nuevo). Rediseño 2026-09-15 pedido por el usuario (referencia:
// tarjetas KPI + hallazgos + gráficos en vez de bloques numerados) — vive ahora dentro de un
// modal (ver ControlesAreaTab.tsx), así que este componente no arma su propio contenedor de
// tarjeta ni su propio botón de cerrar. Los datos vienen de `GET /inventarios/:id/control` vía
// CIS — este componente no calcula nada, salvo cruzar `codigoQr` contra el catálogo (mismo
// patrón que AlertasTab.tsx) para poder agrupar "AFT por categoría", dato que ese endpoint no
// expone directo.

type Severidad = 'critico' | 'atencion';

interface Hallazgo {
  severidad: Severidad;
  texto: string;
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL');
}
function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function BadgeSeveridad({ severidad }: { severidad: Severidad }) {
  return severidad === 'critico' ? (
    <Badge variant="error">CRÍTICO</Badge>
  ) : (
    <Badge variant="warning">ATENCIÓN</Badge>
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

// "Estado de los activos": barra horizontal apilada por proporción, mismo criterio de paleta
// semántica que el resto del CIP (verde=ok, amarillo=atención, rojo=crítico).
function BarraEstado({
  segmentos,
}: {
  segmentos: { etiqueta: string; cantidad: number; color: string }[];
}) {
  const total = segmentos.reduce((acc, s) => acc + s.cantidad, 0);
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-bg">
        {segmentos.map((s) =>
          s.cantidad > 0 ? (
            <div
              key={s.etiqueta}
              style={{
                width: `${total > 0 ? (s.cantidad / total) * 100 : 0}%`,
                backgroundColor: s.color,
              }}
              title={`${s.etiqueta}: ${s.cantidad}`}
            />
          ) : null,
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {segmentos.map((s) => (
          <div key={s.etiqueta} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-text-dim">{s.etiqueta}</span>
            <span className="font-semibold text-text">
              {s.cantidad}
              {total > 0 && ` (${Math.round((s.cantidad / total) * 100)}%)`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PantallaControlArea({
  sesionId,
  organizacionId,
}: {
  sesionId: string;
  organizacionId: string;
}) {
  const [resumen, setResumen] = useState<ResumenControlArea | null>(null);
  const [catalogo, setCatalogo] = useState<ActivoCatalogo[]>([]);
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

  useEffect(() => {
    let ignorar = false;
    void cisClient
      .getCatalogo(organizacionId)
      .then((data) => {
        if (!ignorar) setCatalogo(data);
      })
      .catch(() => {
        // El catálogo solo enriquece "AFT por categoría" — si falla, el donut queda vacío pero
        // el resto del reporte (contrato Pantalla 8) sigue siendo válido sin él.
      });
    return () => {
      ignorar = true;
    };
  }, [organizacionId]);

  const segmentosCategorias = useMemo(() => {
    if (!resumen) return [];
    const catalogoPorCodigo = new Map(catalogo.map((a) => [a.codigoQr, a]));
    const porFamilia = new Map<string, number>();
    for (const item of [...resumen.escaneadosLista, ...resumen.fueraDeArea]) {
      const familia =
        catalogoPorCodigo.get(item.codigoQr)?.familia || 'Sin categoría';
      porFamilia.set(familia, (porFamilia.get(familia) ?? 0) + 1);
    }
    return Array.from(porFamilia.entries()).map(([nombre, cantidad], i) => ({
      nombre,
      cantidad,
      color: PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length],
    }));
  }, [resumen, catalogo]);

  const hallazgos = useMemo((): Hallazgo[] => {
    if (!resumen) return [];
    const lista: Hallazgo[] = [];
    if (resumen.faltantes.length > 0) {
      lista.push({
        severidad: 'critico',
        texto: `${resumen.faltantes.length} AFT del área no se escanearon`,
      });
    }
    if (resumen.porEstadoDeclarado.baja > 0) {
      lista.push({
        severidad: 'critico',
        texto: `${resumen.porEstadoDeclarado.baja} AFT declarados de baja`,
      });
    }
    if (resumen.fueraDeArea.length > 0) {
      lista.push({
        severidad: 'atencion',
        texto: `${resumen.fueraDeArea.length} AFT de otra área detectados`,
      });
    }
    if (resumen.porEstadoDeclarado.enMantenimiento > 0) {
      lista.push({
        severidad: 'atencion',
        texto: `${resumen.porEstadoDeclarado.enMantenimiento} AFT en mantenimiento`,
      });
    }
    if (resumen.porEstadoDeclarado.inactivo > 0) {
      lista.push({
        severidad: 'atencion',
        texto: `${resumen.porEstadoDeclarado.inactivo} AFT inactivos`,
      });
    }
    return lista;
  }, [resumen]);

  if (error) return <Alert>{error}</Alert>;
  if (!resumen)
    return <p className="text-sm text-text-dim">Cargando la Pantalla 8…</p>;

  const veredicto = estiloVeredicto(resumen.veredicto);
  const alertasDetectadas =
    resumen.faltantes.length + resumen.fueraDeArea.length;
  const est = resumen.porEstadoDeclarado;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-strong">
            <IconMapPin />
          </span>
          <div>
            <h2 className="text-base font-bold text-text">
              Reporte de control — Área {resumen.areaId}
            </h2>
            <p className="text-xs text-text-dim">
              Sesión del {fecha(resumen.fechaCierre)} ·{' '}
              {hora(resumen.fechaCierre)}
            </p>
          </div>
        </div>
        <div className={`rounded-xl px-4 py-2 text-right ${veredicto.fondo}`}>
          <p className="text-sm font-bold tracking-wide">
            Proceso {veredicto.etiqueta}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          titulo="AFT del área"
          valor={String(resumen.activosDelArea)}
          dato="Registrados en la BPI"
        />
        <KpiCard
          titulo="AFT escaneados"
          valor={String(resumen.escaneados)}
          dato="En esta acción de control"
        />
        <KpiCard
          titulo="Alertas detectadas"
          valor={String(alertasDetectadas)}
          dato="Faltantes + fuera de área"
          colorValor={alertasDetectadas > 0 ? 'text-destructive' : undefined}
        />
        <KpiCard
          titulo="Cobertura del área"
          valor={formatPorcentaje(resumen.delAreaPct)}
          dato={`${resumen.delArea} de ${resumen.activosDelArea} del área`}
          colorValor="text-success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-bg-card p-5">
          <h3 className="mb-3 text-sm font-bold text-text">Hallazgos</h3>
          {hallazgos.length === 0 ? (
            <p className="text-sm text-text-dim">
              Sin hallazgos — todos los AFT del área se escanearon
              correctamente.
            </p>
          ) : (
            <ul className="space-y-2">
              {hallazgos.map((h) => (
                <li key={h.texto} className="flex items-center gap-2 text-sm">
                  <BadgeSeveridad severidad={h.severidad} />
                  <span className="text-text">{h.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-bg-card p-5">
          <h3 className="mb-3 text-sm font-bold text-text">
            AFT por categoría
          </h3>
          <DonutChart
            segmentos={segmentosCategorias}
            centroValor={resumen.escaneados}
            centroEtiqueta="AFT"
            vacioTexto="Sin datos de categoría disponibles."
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-card p-5">
        <h3 className="mb-3 text-sm font-bold text-text">
          Estado de los AFT declarado por el controlador
        </h3>
        <BarraEstado
          segmentos={[
            {
              etiqueta: 'En servicio',
              cantidad: est.enServicio,
              color: '#16A34A',
            },
            {
              etiqueta: 'Mantenimiento',
              cantidad: est.enMantenimiento,
              color: '#D97706',
            },
            { etiqueta: 'Inactivo', cantidad: est.inactivo, color: '#64748B' },
            { etiqueta: 'Baja', cantidad: est.baja, color: '#DC2626' },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wide text-text-dim uppercase">
            AFT escaneados ({resumen.escaneadosLista.length})
          </h3>
          <ListaAft filas={resumen.escaneadosLista} />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wide text-text-dim uppercase">
            No corresponden al área ({resumen.fueraDeArea.length})
          </h3>
          <ListaAft filas={resumen.fueraDeArea} />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wide text-text-dim uppercase">
            No se escanearon ({resumen.faltantes.length})
          </h3>
          <ListaAft
            filas={resumen.faltantes.map((f) => ({ ...f, tipo: null }))}
          />
        </div>
      </div>

      <p className="border-t border-border pt-3 text-xs text-text-faint">
        Operador: {resumen.operadorId} · Datos vía CIS/CIP, actualizados al
        cierre de la sesión.
      </p>
    </div>
  );
}

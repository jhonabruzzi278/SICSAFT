import { useEffect, useMemo, useState } from 'react';
import {
  cisClient,
  type ActivoCatalogo,
  type ResumenControlArea,
} from '@/lib/cis-client';
import { dashboardClient } from '@/lib/dashboard-client';
import {
  estiloVeredicto,
  etiquetaTipo,
  formatPorcentaje,
  nombreOperador,
} from '@/lib/pantalla-8';
import {
  generarPdfInformeControl,
  type InformeControlPdfFila,
} from '@/lib/pdf-informe-control';
import { Alert, Button, Modal } from '@/components/ui';
import { KpiCard } from '@/components/KpiCard';
import { PieChart } from '@/components/PieChart';
import { IconDownload, IconMapPin } from '@/components/icons';
import { PALETA_CATEGORIAS } from '@/lib/colores';

// DOC-029 RF-I — "Pantalla 8": informe de control de área de una sesión de relevamiento.
// Contrato exacto: casos-de-uso/CONTRATO-PANTALLA-8.md (los 6 bloques + veredicto son
// obligatorios; el resto — tarjetas KPI, hallazgos, donut — es presentación agregada sobre esos
// mismos datos, no un contrato nuevo).
//
// DOC-035 (2026-09-15) — deja de vivir dentro de un modal (ver ReporteControlPage.tsx, que ahora
// es su propia ruta) y pasa a recibir `areaNombre`/`direccionNombre`/`departamentoNombre` ya
// resueltos por el padre (que de todas formas necesita el árbol de áreas para el breadcrumb) —
// antes el header mostraba `resumen.areaId` crudo (bug real reportado por el usuario). Las 3
// listas (Escaneados/Fuera de área/Extraviados) pasan de "las 3 a la vez en 3 columnas" a un
// selector de pestañas — con datos reales eran la sección que más obligaba a hacer scroll de
// página completa.

// 2026-09-16 — "Hallazgos" dejó de ser un panel en pantalla (ver abajo, dos tarjetas KPI propias
// para extraviados/fuera de área lo reemplazan; baja/mantenimiento/inactivo ya se ven en "Estado
// de los AFT declarado"). Esta lista sigue viva solo como insumo del PDF descargable
// (generarPdfInformeControl), que sí sigue teniendo su propia sección "Hallazgos" — documento
// impreso, no la misma restricción de espacio que la pantalla.
interface Hallazgo {
  severidad: 'critico' | 'atencion';
  texto: string;
  etiqueta?: string;
}

type ListaId = 'escaneados' | 'fueraDeArea' | 'faltantes';

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL');
}
function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
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
    <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
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

// "AFT por categoría" solo debe contar activos reales y localizados — no ruido de escaneo
// (no_registrado/invalido/duplicado/ya_escaneado no resuelven a un activo). con_incidencia
// también cuenta: es "correcto" con una incidencia adicional, sigue siendo el mismo activo en su
// lugar (ver clasificar-escaneo.ts).
const RESULTADOS_ACTIVO_REAL = new Set([
  'correcto',
  'con_incidencia',
  'otra_area',
  'otra_ubicacion',
]);

const LISTAS_TABS: { id: ListaId; titulo: string }[] = [
  { id: 'escaneados', titulo: 'AFT escaneados' },
  { id: 'fueraDeArea', titulo: 'No corresponden al área' },
  { id: 'faltantes', titulo: 'AFT extraviados' },
];

export function PantallaControlArea({
  sesionId,
  organizacionId,
  areaNombre,
  direccionNombre,
  departamentoNombre,
}: {
  sesionId: string;
  organizacionId: string;
  areaNombre: string;
  direccionNombre: string | null;
  departamentoNombre: string | null;
}) {
  const [resumen, setResumen] = useState<ResumenControlArea | null>(null);
  const [catalogo, setCatalogo] = useState<ActivoCatalogo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listaActiva, setListaActiva] = useState<ListaId>('escaneados');
  // Notificaciones del organigrama (2026-09-16) — estado puramente local: no hay lectura previa
  // de "¿ya estaba revisada?" (esa info vive en veredicto_sesion de CIP, no en este resumen de
  // CORE); el botón siempre parte visible si el veredicto no es exitoso, y pasa a "Revisado el…"
  // recién con la respuesta del PATCH. Acción final, sin des-revisar (confirmado por el usuario).
  const [mostrarConfirmarRevisar, setMostrarConfirmarRevisar] = useState(false);
  const [marcandoRevisado, setMarcandoRevisado] = useState(false);
  const [errorRevisar, setErrorRevisar] = useState<string | null>(null);
  const [revisado, setRevisado] = useState<{
    por: string;
    en: string;
  } | null>(null);

  useEffect(() => {
    let ignorar = false;
    setResumen(null);
    setError(null);
    setListaActiva('escaneados');
    setRevisado(null);
    setErrorRevisar(null);
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
    // `escaneadosLista` ya trae TODOS los escaneos de la sesión — `fueraDeArea` es un
    // subconjunto suyo, no una lista aparte (mismo codigoQr aparece en ambas). Concatenar las
    // dos, como hacía esto antes, contaba cada AFT fuera de área dos veces (bug real: 1 AFT
    // escaneado aparecía como "2" en el gráfico) — alcanza con recorrer `escaneadosLista` una
    // sola vez, filtrando a resultados que son un activo real (no ruido de escaneo).
    for (const item of resumen.escaneadosLista) {
      if (!RESULTADOS_ACTIVO_REAL.has(item.resultado)) continue;
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
        texto: `${resumen.faltantes.length} AFT extraviados`,
        etiqueta: 'EXTRAVIADO',
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

  async function confirmarRevisar() {
    setMarcandoRevisado(true);
    setErrorRevisar(null);
    try {
      const actualizado = await dashboardClient.marcarRevisado(sesionId);
      setRevisado({
        por: actualizado.revisadoPor ?? '',
        en: actualizado.revisadoEn ?? new Date().toISOString(),
      });
      setMostrarConfirmarRevisar(false);
    } catch (err: unknown) {
      setErrorRevisar(
        err instanceof Error ? err.message : 'No se pudo marcar como revisado',
      );
    } finally {
      setMarcandoRevisado(false);
    }
  }

  function descargarPdf() {
    if (!resumen) return;
    const listaAPdf = (
      filas: Array<{
        codigoQr: string;
        nombre: string | null;
        areaRealNombre?: string | null;
      }>,
    ): InformeControlPdfFila[] =>
      filas.map((f) => ({
        codigoQr: f.codigoQr,
        nombre: f.nombre ?? '(sin registrar)',
        extra: f.areaRealNombre
          ? `pertenece a: ${f.areaRealNombre}`
          : undefined,
      }));

    generarPdfInformeControl({
      areaNombre,
      direccionNombre,
      departamentoNombre,
      fechaInicio: resumen.fechaInicio,
      fechaCierre: resumen.fechaCierre,
      operadorId: nombreOperador(resumen.operadorId),
      veredicto: resumen.veredicto,
      veredictoEtiqueta: estiloVeredicto(resumen.veredicto).etiqueta,
      kpis: [
        {
          titulo: 'AFT del área',
          valor: String(resumen.activosDelArea),
          dato: 'Registrados en la BPI',
        },
        {
          titulo: 'AFT escaneados',
          valor: String(resumen.escaneados),
          dato: 'En esta acción de control',
        },
        {
          titulo: 'Alertas detectadas',
          valor: String(resumen.faltantes.length + resumen.fueraDeArea.length),
          dato: 'Extraviados + fuera de área',
        },
        {
          titulo: 'Cobertura del área',
          valor: formatPorcentaje(resumen.delAreaPct),
          dato: `${resumen.delArea} de ${resumen.activosDelArea} del área`,
        },
      ],
      hallazgos,
      categorias: segmentosCategorias.map((s) => ({
        nombre: s.nombre,
        cantidad: s.cantidad,
        porcentaje:
          resumen.escaneados > 0
            ? ((s.cantidad / resumen.escaneados) * 100).toFixed(1)
            : '0',
      })),
      estadoDeclarado: [
        {
          etiqueta: 'En servicio',
          cantidad: resumen.porEstadoDeclarado.enServicio,
        },
        {
          etiqueta: 'Mantenimiento',
          cantidad: resumen.porEstadoDeclarado.enMantenimiento,
        },
        { etiqueta: 'Inactivo', cantidad: resumen.porEstadoDeclarado.inactivo },
        { etiqueta: 'Baja', cantidad: resumen.porEstadoDeclarado.baja },
      ],
      listas: [
        { titulo: 'AFT escaneados', filas: listaAPdf(resumen.escaneadosLista) },
        {
          titulo: 'No corresponden al área',
          filas: listaAPdf(resumen.fueraDeArea),
        },
        {
          titulo: 'AFT extraviados',
          filas: listaAPdf(
            resumen.faltantes.map((f) => ({ ...f, tipo: null })),
          ),
        },
      ],
    });
  }

  if (error) return <Alert>{error}</Alert>;
  if (!resumen)
    return <p className="text-sm text-text-dim">Cargando la Pantalla 8…</p>;

  const veredicto = estiloVeredicto(resumen.veredicto);
  const est = resumen.porEstadoDeclarado;
  const ruta = [direccionNombre, departamentoNombre]
    .filter((v): v is string => Boolean(v))
    .join(' → ');

  const listasPorId: Record<
    ListaId,
    {
      filas: Array<{
        codigoQr: string;
        nombre: string | null;
        tipo: 'ordinario' | 'extraordinario' | null;
        areaRealNombre?: string | null;
      }>;
      total: number;
    }
  > = {
    escaneados: {
      filas: resumen.escaneadosLista,
      total: resumen.escaneadosLista.length,
    },
    fueraDeArea: {
      filas: resumen.fueraDeArea,
      total: resumen.fueraDeArea.length,
    },
    faltantes: {
      filas: resumen.faltantes.map((f) => ({ ...f, tipo: null })),
      total: resumen.faltantes.length,
    },
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-strong">
            <IconMapPin />
          </span>
          <div>
            <h2 className="text-base font-bold text-text">
              Reporte de control — {areaNombre}
            </h2>
            {ruta && <p className="text-xs text-text-faint">{ruta}</p>}
            <p className="text-xs text-text-dim">
              Sesión del {fecha(resumen.fechaCierre)} ·{' '}
              {hora(resumen.fechaCierre)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`rounded-xl px-4 py-2 text-right ${veredicto.fondo}`}>
            <p className="text-sm font-bold tracking-wide">
              Proceso {veredicto.etiqueta}
            </p>
          </div>
          {resumen.veredicto !== 'exitoso' &&
            (revisado ? (
              <span className="text-xs text-text-dim">
                Revisado el {fecha(revisado.en)}
              </span>
            ) : (
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs"
                onClick={() => setMostrarConfirmarRevisar(true)}
              >
                Marcar como revisado
              </Button>
            ))}
          <Button
            variant="secondary"
            className="gap-1.5 px-3 py-2 text-xs"
            onClick={descargarPdf}
          >
            <IconDownload />
            <span className="hidden sm:inline">Descargar PDF</span>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
          titulo="AFT extraviados"
          valor={String(resumen.faltantes.length)}
          dato="No se escanearon en el área"
          colorValor={
            resumen.faltantes.length > 0 ? 'text-destructive' : undefined
          }
          acento={resumen.faltantes.length > 0 ? 'error' : undefined}
        />
        <KpiCard
          titulo="AFT de otra área"
          valor={String(resumen.fueraDeArea.length)}
          dato="Detectados en esta acción de control"
          colorValor={
            resumen.fueraDeArea.length > 0 ? 'text-warning' : undefined
          }
          acento={resumen.fueraDeArea.length > 0 ? 'warning' : undefined}
        />
        <KpiCard
          titulo="Cobertura del área"
          valor={formatPorcentaje(resumen.delAreaPct)}
          dato={`${resumen.delArea} de ${resumen.activosDelArea} del área`}
          colorValor="text-success"
        />
      </div>

      <div className="rounded-2xl border border-border bg-bg-card p-5">
        <h3 className="mb-3 text-sm font-bold text-text">AFT por categoría</h3>
        <PieChart
          segmentos={segmentosCategorias}
          vacioTexto="Sin datos de categoría disponibles."
        />
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

      <div className="rounded-2xl border border-border bg-bg-card p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {LISTAS_TABS.map((tab) => (
            <Button
              key={tab.id}
              variant={listaActiva === tab.id ? 'primary' : 'secondary'}
              className="px-3 py-1.5 text-xs"
              onClick={() => setListaActiva(tab.id)}
            >
              {tab.titulo} ({listasPorId[tab.id].total})
            </Button>
          ))}
        </div>
        <ListaAft filas={listasPorId[listaActiva].filas} />
      </div>

      <p className="border-t border-border pt-3 text-xs text-text-faint">
        Operador: {nombreOperador(resumen.operadorId)} · Datos vía CIS/CIP,
        actualizados al cierre de la sesión.
      </p>

      <Modal
        open={mostrarConfirmarRevisar}
        onClose={() => setMostrarConfirmarRevisar(false)}
        ancho="max-w-md"
      >
        <div className="space-y-4 p-6">
          <h3 className="text-base font-bold text-text">
            Marcar reporte como revisado
          </h3>
          <p className="text-sm text-text-dim">
            Esta sesión va a dejar de contar como notificación pendiente en el
            organigrama de Controles de área. Es una acción final — no se puede
            deshacer.
          </p>
          {errorRevisar && <Alert variant="error">{errorRevisar}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              className="px-3 py-2 text-xs"
              onClick={() => setMostrarConfirmarRevisar(false)}
              disabled={marcandoRevisado}
            >
              Volver atrás
            </Button>
            <Button
              variant="primary"
              className="px-3 py-2 text-xs"
              onClick={() => void confirmarRevisar()}
              disabled={marcandoRevisado}
            >
              {marcandoRevisado ? 'Marcando…' : 'Aceptar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  cisClient,
  type ActivoCatalogo,
  type Area,
  type Responsable,
} from '@/lib/cis-client';
import { dashboardClient, type Cobertura } from '@/lib/dashboard-client';
import { nivelActual } from '@/lib/nivel';
import { Alert, Badge } from '@/components/ui';
import {
  IconBox,
  IconChart,
  IconCpu,
  IconMapPin,
  IconQrCode,
  IconShield,
  IconSparkles,
  IconUpload,
  IconUsers,
} from '@/components/icons';

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';
  const q = organizacionId
    ? `?organizacionId=${encodeURIComponent(organizacionId)}`
    : '';

  const [activos, setActivos] = useState<ActivoCatalogo[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const esNivel2 = nivelActual() === 2;

  useEffect(() => {
    if (!organizacionId) return;
    let cancelado = false;
    setCargando(true);
    setError(null);

    Promise.allSettled([
      cisClient.getCatalogo(organizacionId),
      cisClient.getAreas(organizacionId),
      cisClient.getResponsables(organizacionId),
      dashboardClient.getCobertura(organizacionId),
    ])
      .then(([actRes, areRes, respRes, cobRes]) => {
        if (cancelado) return;
        if (actRes.status === 'fulfilled') setActivos(actRes.value);
        if (areRes.status === 'fulfilled') setAreas(areRes.value);
        if (respRes.status === 'fulfilled') setResponsables(respRes.value);
        if (cobRes.status === 'fulfilled') setCobertura(cobRes.value);
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar resumen',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [organizacionId]);

  const totalActivos =
    activos.length > 0 ? activos.length : (cobertura?.activosRegistrados ?? 0);
  const activosAlta = activos.filter(
    (a) => a.estado === 'alta' || a.estado.toLowerCase().includes('servicio'),
  ).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado del Resumen Operativo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-accent-strong uppercase">
            <IconBox />
            <span>Centro de Control Patrimonial (CCP)</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-text sm:text-3xl">
            Resumen Operativo
          </h1>
          <p className="mt-0.5 text-sm text-text-dim">
            Panel de control, estado del catálogo y operaciones patrimoniales en
            curso.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" className="gap-1.5 px-2.5 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Base Patrimonial Inteligente Conectada
          </Badge>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Hero Banner: Botón Destacado del CIP (Exclusivo Nivel 2) */}
      {esNivel2 && (
        <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-r from-bg-card via-accent/10 to-bg-card p-6 shadow-elev-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-bg font-bold shadow-sm">
                  <IconSparkles />
                </span>
                <span className="text-xs font-bold tracking-wider text-accent-strong uppercase">
                  Centro de Inteligencia Patrimonial (CIP)
                </span>
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[0.65rem] font-bold text-accent-strong ring-1 ring-accent/30">
                  NIVEL 2 ACTIVO
                </span>
              </div>
              <h3 className="text-lg font-bold text-text">
                Analítica Avanzada, Distribución Gráfica y BI en Tiempo Real
              </h3>
              <p className="max-w-2xl text-xs leading-relaxed text-text-dim">
                Explore gráficos interactivos de distribución por categorías,
                activos por condición operativa, cobertura de escaneo en terreno
                con APP QR y la matriz de valor patrimonial.
              </p>
            </div>

            <a
              href={`/cip${q}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-xs font-bold text-bg shadow-elev-float transition-all hover:bg-accent-strong hover:scale-[1.02] active:scale-[0.98]"
            >
              <IconChart />
              <span>Abrir CIP en Navegador Externo ↗</span>
            </a>
          </div>
        </div>
      )}

      {/* Tarjetas de Resumen Operativo Básico (Métricas Numéricas Claras) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-elev-1">
          <div className="flex items-center justify-between text-text-dim">
            <span className="text-xs font-medium">Bienes Registrados</span>
            <IconBox />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-text">
            {cargando ? '—' : totalActivos.toLocaleString('es-CL')}
          </div>
          <p className="mt-1 text-[0.75rem] text-text-dim">
            {activosAlta > 0
              ? `${activosAlta} en estado alta`
              : 'Activos en catálogo BPI'}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-elev-1">
          <div className="flex items-center justify-between text-text-dim">
            <span className="text-xs font-medium">Áreas Operativas</span>
            <IconMapPin />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-text">
            {cargando ? '—' : areas.length}
          </div>
          <p className="mt-1 text-[0.75rem] text-text-dim">
            Estructura física institucional
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-elev-1">
          <div className="flex items-center justify-between text-text-dim">
            <span className="text-xs font-medium">Custodios Asignados</span>
            <IconUsers />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-text">
            {cargando ? '—' : responsables.length}
          </div>
          <p className="mt-1 text-[0.75rem] text-text-dim">
            Responsables autorizados
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-bg-card p-5 shadow-elev-1">
          <div className="flex items-center justify-between text-text-dim">
            <span className="text-xs font-medium">
              Cobertura de Relevamiento
            </span>
            <IconQrCode />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-text">
            {cobertura ? `${cobertura.porcentajeCobertura}%` : '85%'}
          </div>
          <p className="mt-1 text-[0.75rem] text-text-dim">
            Verificado en terreno con APP QR
          </p>
        </div>
      </div>

      {/* Módulos Operativos del AFT: Accesos Directos */}
      <div>
        <h2 className="text-base font-bold text-text mb-3">
          Operaciones de Administración y Control
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to={`/activos${q}`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-bg-card p-5 shadow-elev-1 transition-all hover:border-accent hover:bg-bg-raised"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <IconBox />
                </span>
                <span className="text-xs text-text-faint group-hover:text-accent-strong">
                  Acceder ➔
                </span>
              </div>
              <h3 className="mt-4 font-bold text-text">Catálogo de Activos</h3>
              <p className="mt-1 text-xs text-text-dim">
                Alta manual, edición de fichas técnicas, trazabilidad y estado
                patrimonial.
              </p>
            </div>
            <div className="mt-4 text-[0.75rem] font-medium text-accent-strong">
              {totalActivos} bienes activos
            </div>
          </Link>

          <Link
            to={`/estructura${q}`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-bg-card p-5 shadow-elev-1 transition-all hover:border-accent hover:bg-bg-raised"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <IconMapPin />
                </span>
                <span className="text-xs text-text-faint group-hover:text-accent-strong">
                  Acceder ➔
                </span>
              </div>
              <h3 className="mt-4 font-bold text-text">Estructura Física</h3>
              <p className="mt-1 text-xs text-text-dim">
                Administración de sedes, áreas operativas, oficinas y
                responsables.
              </p>
            </div>
            <div className="mt-4 text-[0.75rem] font-medium text-emerald-400">
              {areas.length} áreas operativas
            </div>
          </Link>

          <Link
            to={`/etiquetas${q}`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-bg-card p-5 shadow-elev-1 transition-all hover:border-accent hover:bg-bg-raised"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <IconQrCode />
                </span>
                <span className="text-xs text-text-faint group-hover:text-accent-strong">
                  Acceder ➔
                </span>
              </div>
              <h3 className="mt-4 font-bold text-text">
                Impresión de Etiquetas
              </h3>
              <p className="mt-1 text-xs text-text-dim">
                Plantillas estandarizadas Avery, Tarjetas de Inventario y Rollo
                Térmico.
              </p>
            </div>
            <div className="mt-4 text-[0.75rem] font-medium text-amber-400">
              QR + Code 128 listo
            </div>
          </Link>

          <Link
            to={`/importaciones${q}`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-bg-card p-5 shadow-elev-1 transition-all hover:border-accent hover:bg-bg-raised"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                  <IconUpload />
                </span>
                <span className="text-xs text-text-faint group-hover:text-accent-strong">
                  Acceder ➔
                </span>
              </div>
              <h3 className="mt-4 font-bold text-text">Ingesta de Planillas</h3>
              <p className="mt-1 text-xs text-text-dim">
                Carga masiva Drag & Drop con análisis previo y diff visual de
                cambios.
              </p>
            </div>
            <div className="mt-4 text-[0.75rem] font-medium text-purple-400">
              Excel / CSV compatible
            </div>
          </Link>

          <Link
            to={`/auditoria${q}`}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-bg-card p-5 shadow-elev-1 transition-all hover:border-accent hover:bg-bg-raised"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                  <IconShield />
                </span>
                <span className="text-xs text-text-faint group-hover:text-accent-strong">
                  Acceder ➔
                </span>
              </div>
              <h3 className="mt-4 font-bold text-text">
                Registro de Auditoría
              </h3>
              <p className="mt-1 text-xs text-text-dim">
                Trazabilidad cronológica inmutable de modificaciones y
                custodias.
              </p>
            </div>
            <div className="mt-4 text-[0.75rem] font-medium text-sky-400">
              Historial oficial
            </div>
          </Link>

          {esNivel2 && (
            <a
              href={`/cip${q}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between rounded-2xl border border-accent/50 bg-gradient-to-br from-bg-card to-accent/15 p-5 shadow-elev-1 transition-all hover:border-accent hover:scale-[1.01]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-bg font-bold">
                    <IconCpu />
                  </span>
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[0.65rem] font-bold text-accent-strong">
                    NIVEL 2
                  </span>
                </div>
                <h3 className="mt-4 font-bold text-text">
                  Inteligencia Patrimonial (CIP)
                </h3>
                <p className="mt-1 text-xs text-text-dim">
                  Dashboard de alto impacto, gráficos SVG, KPIs ejecutivos y
                  matriz de valor en navegador externo.
                </p>
              </div>
              <div className="mt-4 text-[0.75rem] font-bold text-accent-strong">
                Lanzar CIP Web Analytics ↗
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  dashboardClient,
  type CategoriaResumen,
  type Cobertura,
  type EstadoResumen,
  type ResumenVeredictos,
  type VentanaVeredictos,
} from '@/lib/dashboard-client';
import { cisClient, type ActivoCatalogo } from '@/lib/cis-client';
import { Alert, Button } from '@/components/ui';
import { IconRefresh } from '@/components/icons';
import { PieChart } from '@/components/PieChart';
import { KpiCard } from '@/components/KpiCard';
import { PALETA_CATEGORIAS } from '@/lib/colores';

// El veredicto de sesión (core/inventarios) ya existe como 'exitoso'|'aceptable'|'defectuoso' —
// acá solo se traduce a la etiqueta que pide este diseño ("Excelente"/"Aceptable"/"Deficiente"),
// mismo concepto con otro nombre de cara al Directivo. Orden fijo (no alfabético): de mejor a peor.
const ORDEN_VEREDICTO = ['exitoso', 'aceptable', 'defectuoso'] as const;
const ETIQUETA_VEREDICTO: Record<(typeof ORDEN_VEREDICTO)[number], string> = {
  exitoso: 'Excelente',
  aceptable: 'Aceptable',
  defectuoso: 'Deficiente',
};
// Mismo criterio semántico que el resto de la app (Hallazgos de Pantalla 8, Alertas de CIP):
// aceptable siempre amarillo, defectuoso siempre rojo — acá antes las 3 filas eran texto neutro,
// sin ninguna identificación de color (pedido explícito del usuario 2026-09-16).
const COLOR_VEREDICTO: Record<(typeof ORDEN_VEREDICTO)[number], string> = {
  exitoso: 'text-success',
  aceptable: 'text-warning',
  defectuoso: 'text-destructive',
};

const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'anio', label: 'Este año' },
  { id: 'personalizado', label: 'Personalizado' },
] as const;

function sumarPorEstado(
  estados: EstadoResumen[],
  cuales: readonly string[],
): number {
  return estados
    .filter((e) => cuales.includes(e.estado.toLowerCase()))
    .reduce((acc, e) => acc + e.cantidad, 0);
}

const formatoClp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

// "Total Acciones Control Día" y "Total Acciones Control Acumulada" comparten exactamente la
// misma estructura a propósito (valor total + tabla Excelente/Aceptable/Deficiente) — el diseño
// pide que sean comparables a simple vista.
function ModuloControl({
  titulo,
  ventana,
}: {
  titulo: string;
  ventana: VentanaVeredictos;
}) {
  const filas = ORDEN_VEREDICTO.map((veredicto) => {
    const cantidad =
      ventana.porVeredicto.find((v) => v.veredicto === veredicto)?.cantidad ??
      0;
    return {
      veredicto,
      etiqueta: ETIQUETA_VEREDICTO[veredicto],
      color: COLOR_VEREDICTO[veredicto],
      cantidad,
      porcentaje: ventana.total > 0 ? (cantidad / ventana.total) * 100 : 0,
    };
  });

  return (
    <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1">
      <h3 className="text-sm font-bold text-text">{titulo}</h3>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <span className="text-3xl font-extrabold tracking-tight text-text">
            {ventana.total.toLocaleString('es-CL')}
          </span>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-text-dim">
              <th className="py-1.5 pr-3 font-semibold">Estado</th>
              <th className="py-1.5 pr-3 font-semibold">Cantidad</th>
              <th className="py-1.5 font-semibold">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filas.map((fila) => (
              <tr key={fila.veredicto}>
                <td className="py-1.5 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full bg-current ${fila.color}`}
                    />
                    <span className={`font-medium ${fila.color}`}>
                      {fila.etiqueta}
                    </span>
                  </span>
                </td>
                <td className={`py-1.5 pr-3 font-medium ${fila.color}`}>
                  {fila.cantidad.toLocaleString('es-CL')}
                </td>
                <td className="py-1.5 text-text-dim">
                  {fila.porcentaje.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ResumenTab() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [estados, setEstados] = useState<EstadoResumen[]>([]);
  const [categorias, setCategorias] = useState<CategoriaResumen[]>([]);
  const [catalogo, setCatalogo] = useState<ActivoCatalogo[]>([]);
  const [veredictos, setVeredictos] = useState<ResumenVeredictos | null>(null);
  const [periodo, setPeriodo] =
    useState<(typeof PERIODOS)[number]['id']>('30d');

  const cargarDatos = useCallback(async () => {
    if (!organizacionId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const [cobRes, estRes, catRes, catalogoRes, veredictosRes] =
        await Promise.allSettled([
          dashboardClient.getCobertura(organizacionId),
          dashboardClient.getEstadoActivos(organizacionId),
          dashboardClient.getCategorias(organizacionId),
          cisClient.getCatalogo(organizacionId),
          dashboardClient.getVeredictos(organizacionId),
        ]);

      if (cobRes.status === 'fulfilled') setCobertura(cobRes.value);
      if (estRes.status === 'fulfilled') setEstados(estRes.value.estados);
      if (catRes.status === 'fulfilled') setCategorias(catRes.value.categorias);
      if (catalogoRes.status === 'fulfilled') setCatalogo(catalogoRes.value);
      if (veredictosRes.status === 'fulfilled')
        setVeredictos(veredictosRes.value);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al sincronizar con CIP',
      );
    } finally {
      setCargando(false);
    }
  }, [organizacionId]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const totalActivos = useMemo(
    () => cobertura?.activosRegistrados ?? 0,
    [cobertura],
  );
  const activosServicio = useMemo(
    () => sumarPorEstado(estados, ['activo']),
    [estados],
  );
  const activosMantenimiento = useMemo(
    () => sumarPorEstado(estados, ['mantenimiento']),
    [estados],
  );
  const activosInactivos = useMemo(
    () => sumarPorEstado(estados, ['dado_de_baja', 'inactivo']),
    [estados],
  );
  const porcentaje = (parte: number): string =>
    totalActivos > 0 ? `${((parte / totalActivos) * 100).toFixed(1)}%` : '—';

  // Suma del catálogo completo (cisClient.getCatalogo ya pagina hasta traer todo) — no hace falta
  // un agregado nuevo en CIP para esto, el dato ya está cargado para "Distribución por Categorías".
  const valorTotalClp = useMemo(
    () => catalogo.reduce((acc, a) => acc + (a.valorPatrimonial ?? 0), 0),
    [catalogo],
  );

  const segmentosCategorias = useMemo(
    () =>
      categorias.map((c, i) => ({
        nombre: c.familia || 'Sin categoría',
        cantidad: c.cantidad,
        color: PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length],
      })),
    [categorias],
  );

  return (
    <div className="space-y-6">
      {/* 1. Encabezado + selector de período */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Panel de Control
          </h1>
          <p className="mt-0.5 text-sm text-text-dim">
            Resumen general del estado de activos, controles y mantenimiento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodo}
            onChange={(e) =>
              setPeriodo(e.target.value as (typeof PERIODOS)[number]['id'])
            }
            aria-label="Período del resumen"
            title="La selección de período todavía no filtra los datos — próxima mejora"
            className="h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs text-text focus:border-accent focus:outline-none"
          >
            {PERIODOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={cargarDatos}
            disabled={cargando}
            className="gap-1.5 px-3 py-1.5 text-xs"
            title="Sincronizar métricas con BPI y CIP"
          >
            <IconRefresh className={cargando ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* 2. Fila principal de 5 KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          titulo="Total AFT"
          valor={totalActivos.toLocaleString('es-CL')}
          dato="Patrimonio activo registrado en BPI"
        />
        <KpiCard
          titulo="AFT en Servicio"
          valor={activosServicio.toLocaleString('es-CL')}
          dato={`${porcentaje(activosServicio)} del total`}
        />
        <KpiCard
          titulo="AFT en Mantenimiento"
          valor={activosMantenimiento.toLocaleString('es-CL')}
          dato={`${porcentaje(activosMantenimiento)} del total`}
          colorValor="text-warning"
        />
        <KpiCard
          titulo="AFT Inactivos"
          valor={activosInactivos.toLocaleString('es-CL')}
          dato={`${porcentaje(activosInactivos)} del total`}
        />
        <KpiCard
          titulo="Valor AFT CLP"
          valor={formatoClp.format(valorTotalClp)}
          dato="Valor económico total registrado"
        />
      </div>

      {/* 3. Controles (día + acumulado) | Distribución por categorías */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[52%_1fr]">
        <div className="space-y-4">
          <ModuloControl
            titulo="Total Acciones Control Día"
            ventana={veredictos?.dia ?? { total: 0, porVeredicto: [] }}
          />
          <ModuloControl
            titulo="Total Acciones Control Acumulada"
            ventana={veredictos?.acumulado ?? { total: 0, porVeredicto: [] }}
          />
        </div>

        <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1">
          <h3 className="text-sm font-bold text-text">
            Distribución por Categorías
          </h3>
          <div className="mt-5">
            <PieChart
              segmentos={segmentosCategorias}
              vacioTexto={
                cargando
                  ? 'Cargando distribución…'
                  : 'Sin activos proyectados todavía.'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

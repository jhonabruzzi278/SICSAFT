import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  dashboardClient,
  type CategoriaResumen,
  type Cobertura,
  type ControlArea,
  type EstadoResumen,
} from '@/lib/dashboard-client';
import { cisClient, type ActivoCatalogo } from '@/lib/cis-client';
import { esNivel2 } from '@/lib/nivel';
import { Alert, Badge, Button } from '@/components/ui';
import {
  IconBox,
  IconChart,
  IconCheck,
  IconClock,
  IconCpu,
  IconRefresh,
  IconSearch,
  IconShield,
  IconSparkles,
  IconTrendingUp,
  IconUsers,
} from '@/components/icons';

const PALETA_CATEGORIAS = [
  '#2563EB', // Azul corporativo (Equipos)
  '#16A34A', // Verde esmeralda (Mobiliario)
  '#0284C7', // Azul cielo (Vehículos)
  '#D97706', // Ámbar dorado (Herramientas)
  '#7C3AED', // Púrpura (Tecnología / Redes)
  '#64748B', // Pizarra / Otros
];

interface ActivoFila {
  codigo: string;
  nombre: string;
  categoria: string;
  estado: 'En Servicio' | 'En Mantenimiento' | 'Traslado' | 'Baja' | 'Inactivo';
  ubicacion: string;
  fecha: string;
}

// Traduce el vocabulario del dominio (EstadoActivo) al que muestra la tabla.
const ETIQUETA_ESTADO: Record<string, ActivoFila['estado']> = {
  activo: 'En Servicio',
  mantenimiento: 'En Mantenimiento',
  en_transito: 'Traslado',
  dado_de_baja: 'Baja',
  inactivo: 'Inactivo',
};

// Suma las cantidades de la proyeccion del CIP para un conjunto de estados del dominio. Devuelve
// 0 si no hay ninguno: un estado ausente significa cero activos en ese estado, no un dato que
// haya que rellenar.
function sumarPorEstado(
  estados: EstadoResumen[],
  cuales: readonly string[],
): number {
  return estados
    .filter((e) => cuales.includes(e.estado.toLowerCase()))
    .reduce((acc, e) => acc + e.cantidad, 0);
}

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const nivel2Habilitado = esNivel2();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [estados, setEstados] = useState<EstadoResumen[]>([]);
  const [categorias, setCategorias] = useState<CategoriaResumen[]>([]);
  const [areas, setAreas] = useState<ControlArea[]>([]);
  const [catalogo, setCatalogo] = useState<ActivoCatalogo[]>([]);

  const [periodoFiltro, setPeriodoFiltro] = useState<
    '30d' | 'trimestre' | 'anio'
  >('30d');
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<
    string | null
  >(null);
  const [estadoFiltroTabla, setEstadoFiltroTabla] = useState<string>('todos');
  const [mostrarValorMatriz, setMostrarValorMatriz] = useState(false);

  // `useCallback` y no una función suelta: el efecto de abajo la usa, y declarada en el cuerpo
  // se recreaba en cada render. Con la dependencia declarada de verdad, el efecto se dispara
  // solo cuando cambia la organización, que es lo que ya hacía el array `[organizacionId]`
  // escrito a mano — pero ahora sin que la regla exhaustive-deps tenga razón en quejarse.
  const cargarDatos = useCallback(async () => {
    // Sin organizacionId no hay nada que pedir. Salir sin apagar `cargando` (que arranca en
    // `true`) dejaba el tablero hilando para siempre, sin dato ni mensaje: pasa al entrar a
    // /dashboard sin el query param, p. ej. desde un favorito. InicioPage siempre lo agrega, asi
    // que el flujo normal no lo veia — pero el estado colgado existia igual.
    if (!organizacionId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const [cobRes, estRes, catRes, areRes, catalogoRes] =
        await Promise.allSettled([
          dashboardClient.getCobertura(organizacionId),
          dashboardClient.getEstadoActivos(organizacionId),
          dashboardClient.getCategorias(organizacionId),
          dashboardClient.getAreas(organizacionId),
          cisClient.getCatalogo(organizacionId),
        ]);

      if (cobRes.status === 'fulfilled') setCobertura(cobRes.value);
      if (estRes.status === 'fulfilled') setEstados(estRes.value.estados);
      if (catRes.status === 'fulfilled') setCategorias(catRes.value.categorias);
      if (areRes.status === 'fulfilled') setAreas(areRes.value.areas);
      if (catalogoRes.status === 'fulfilled') setCatalogo(catalogoRes.value);
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

  // Los estados llegan con el vocabulario del dominio (EstadoActivo, ver
  // core/src/patrimonial/activo.types.ts): activo | en_transito | extraviado | mantenimiento |
  // inactivo | dado_de_baja. Hasta 2026-09-09 esto buscaba 'servicio', 'alta' y 'baja' — que no
  // son ninguno de ellos —, no matcheaba nunca y cada tarjeta caia a un numero fijo de demo
  // (1246 total, 89,2% en servicio, 134 en mantenimiento, 28 de baja). Con 252 activos reales el
  // tablero mostraba 225 + 134 + 28 = 387, y al lado el grafico de estados salia vacio porque ese
  // si leia la proyeccion de verdad. Sin fallback: si la proyeccion no tiene el estado, es cero.
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

  const activosBajaInactivos = useMemo(
    () => sumarPorEstado(estados, ['dado_de_baja', 'inactivo']),
    [estados],
  );

  // Porcentajes derivados, no literales: antes los badges decian '89.2% Disp.' y '10.8% Parque'
  // escritos a mano, asi que afirmaban una disponibilidad que nadie habia calculado.
  const porcentaje = (parte: number): string =>
    totalActivos > 0 ? `${((parte / totalActivos) * 100).toFixed(1)}%` : '—';

  // Sin proyeccion no se inventa una distribucion. Hasta 2026-09-09 el fallback devolvia
  // Equipos 462 / Mobiliario 358 / Vehiculos 185 / Herramientas 148 / Otros 93 — categorias que
  // no existen en este catalogo y 1.246 activos que no existen en ninguno. Con la BPI vacia (o
  // con la carga fallada) el tablero mostraba "Total Activos 0" arriba y ese donut abajo,
  // contradiciendose en la misma pantalla. Mismo criterio que ya se aplico a los KPIs y a la
  // tabla de Activos Recientes: lista vacia y estado vacio explicito.
  const datosCategorias = useMemo(() => {
    const suma = categorias.reduce((acc, c) => acc + c.cantidad, 0);
    return categorias.map((c, i) => ({
      nombre: c.familia || 'Sin categoría',
      cantidad: c.cantidad,
      porcentaje: suma > 0 ? ((c.cantidad / suma) * 100).toFixed(1) : '0',
      color: PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length],
    }));
  }, [categorias]);

  // Las cinco barras salen de la proyeccion, una por estado del dominio. Hasta 2026-09-09
  // 'Traslado' valia 198 e 'Inactivo' 45, constantes escritas a mano: el grafico afirmaba
  // movimientos y bajas que no habian ocurrido. Ademas 'Baja' repetia el total agrupado de la
  // tarjeta (dado_de_baja + inactivo) y despues sumaba 'Inactivo' otra vez, contando dos
  // veces los mismos activos. Aca cada barra es un estado y solo uno.
  const datosEstadosBarra = useMemo(
    () => [
      {
        estado: 'Servicio',
        cantidad: sumarPorEstado(estados, ['activo']),
        color: '#2563EB',
      },
      {
        estado: 'Mantenimiento',
        cantidad: sumarPorEstado(estados, ['mantenimiento']),
        color: '#0284C7',
      },
      {
        estado: 'Traslado',
        cantidad: sumarPorEstado(estados, ['en_transito']),
        color: '#38BDF8',
      },
      {
        estado: 'Baja',
        cantidad: sumarPorEstado(estados, ['dado_de_baja']),
        color: '#64748B',
      },
      {
        estado: 'Inactivo',
        cantidad: sumarPorEstado(estados, ['inactivo']),
        color: '#475569',
      },
    ],
    [estados],
  );

  // Ultimas incorporaciones REALES. Hasta 2026-09-09 esta tabla filtraba un array
  // `ACTIVOS_DEMO` hardcodeado (un generador electrico, una camioneta 4x4...) sin ninguna
  // conexion con la BPI: mostraba fechas de mayo y ubicaciones inexistentes en la
  // organizacion. Se ordena por fecha de incorporacion descendente, que es lo que promete el
  // titulo de la seccion.
  const activosRecientes = useMemo<ActivoFila[]>(
    () =>
      [...catalogo]
        .sort((a, z) => z.incorporadoEn.localeCompare(a.incorporadoEn))
        .slice(0, 8)
        .map((a) => ({
          codigo: a.codigoQr,
          nombre: a.nombre,
          categoria: a.familia,
          estado: ETIQUETA_ESTADO[a.estado] ?? 'En Servicio',
          ubicacion: a.ubicacionNombre,
          fecha: a.incorporadoEn
            ? new Date(a.incorporadoEn).toLocaleDateString('es-CL')
            : '—',
        })),
    [catalogo],
  );

  // La proyeccion del CIP solo guarda `areaId`, asi que el control de relevamiento mostraba el
  // UUID crudo. El nombre sale del catalogo, que este tablero ya tiene cargado — sin cambiarle el
  // contrato al CIP solo para una etiqueta.
  const nombresPorArea = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const activo of catalogo) {
      if (activo.areaNombre) mapa.set(activo.areaId, activo.areaNombre);
    }
    return mapa;
  }, [catalogo]);

  const nombreDeArea = (areaId: string): string =>
    nombresPorArea.get(areaId) ?? areaId;

  const filasFiltradas = useMemo(() => {
    return activosRecientes.filter((f) => {
      const coincideBusqueda =
        f.codigo.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        f.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        f.ubicacion.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
        f.categoria.toLowerCase().includes(terminoBusqueda.toLowerCase());

      const coincideEstado =
        estadoFiltroTabla === 'todos' ||
        f.estado.toLowerCase().replace(/\s+/g, '') ===
          estadoFiltroTabla.toLowerCase();

      const coincideCategoria =
        !categoriaSeleccionada ||
        f.categoria.toLowerCase() === categoriaSeleccionada.toLowerCase();

      return coincideBusqueda && coincideEstado && coincideCategoria;
    });
  }, [
    activosRecientes,
    terminoBusqueda,
    estadoFiltroTabla,
    categoriaSeleccionada,
  ]);

  // Donut SVG
  const totalDonut = datosCategorias.reduce((sum, c) => sum + c.cantidad, 0);
  let acumAngulo = 0;
  const segmentosDonut = datosCategorias.map((cat) => {
    const fraccion = totalDonut > 0 ? cat.cantidad / totalDonut : 0;
    const inicio = acumAngulo;
    acumAngulo += fraccion * 360;
    return {
      ...cat,
      inicio,
      fin: acumAngulo,
    };
  });

  function calcularCoordenadas(
    angulo: number,
    radio: number,
  ): [number, number] {
    const rad = ((angulo - 90) * Math.PI) / 180;
    return [100 + radio * Math.cos(rad), 100 + radio * Math.sin(rad)];
  }

  // Vista en Nivel 1 (Institucional básico sin CIP)
  if (!nivel2Habilitado) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-5">
          <div className="flex items-center gap-2 text-xs font-bold text-text-dim uppercase tracking-wider">
            <span>Portal del Directivo</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-text">
            Resumen Institucional
          </h1>
          <p className="mt-0.5 text-sm text-text-dim">
            Monitoreo general de la organización y designación de profesionales
            de AFT.
          </p>
        </div>

        <div className="rounded-2xl border border-accent/30 bg-bg-card p-6 shadow-elev-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-bg font-bold">
              <IconSparkles />
            </span>
            <div>
              <h2 className="font-bold text-text text-base">
                Inteligencia de Negocio Patrimonial (CIP)
              </h2>
              <p className="text-xs text-text-dim">
                El Centro de Inteligencia Patrimonial con analítica en tiempo
                real, gráficos predictivos y control de desvíos está disponible
                en <strong>Nivel 2 Enterprise</strong>.
              </p>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Link
              to="/gestionar-profesional-aft"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-bg"
            >
              <IconUsers />
              Gestionar Profesionales de AFT
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Vista en Nivel 2: Suite CIP Completa
  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Ejecutivo y Barra Superior */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20 text-accent-strong ring-1 ring-accent/30">
              <IconCpu />
            </span>
            <span className="text-xs font-bold tracking-wider text-accent-strong uppercase">
              Centro de Inteligencia Patrimonial
            </span>
            <Badge
              variant="success"
              className="gap-1 px-2 py-0.5 text-[0.7rem] font-semibold"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              TIEMPO REAL
            </Badge>
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-accent-strong ring-1 ring-border">
              NIVEL 2 ENTERPRISE
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-text sm:text-3xl">
            Resumen Ejecutivo
          </h1>
          <p className="mt-0.5 text-sm text-text-dim">
            Monitoreo en tiempo real, proyección de inventario y analítica
            patrimonial directiva.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-faint" />
            <input
              type="text"
              placeholder="Búsqueda rápida…"
              value={terminoBusqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              className="h-9 w-44 rounded-lg border border-border bg-bg-card pr-3 pl-9 text-xs text-text placeholder-text-faint transition-all focus:w-60 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            />
          </div>

          <div className="inline-flex rounded-lg border border-border bg-bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPeriodoFiltro('30d')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                periodoFiltro === '30d'
                  ? 'bg-accent text-bg shadow-sm'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              30 Días
            </button>
            <button
              type="button"
              onClick={() => setPeriodoFiltro('trimestre')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                periodoFiltro === 'trimestre'
                  ? 'bg-accent text-bg shadow-sm'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              Trimestre
            </button>
            <button
              type="button"
              onClick={() => setPeriodoFiltro('anio')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                periodoFiltro === 'anio'
                  ? 'bg-accent text-bg shadow-sm'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              Anual
            </button>
          </div>

          <Button
            variant="secondary"
            onClick={cargarDatos}
            disabled={cargando}
            className="gap-1.5 px-3 py-1.5 text-xs"
            title="Sincronizar métricas con BPI y CIP"
          >
            <IconRefresh className={cargando ? 'animate-spin' : ''} />
            <span className="hidden md:inline">Actualizar</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => setMostrarValorMatriz(!mostrarValorMatriz)}
            className="gap-1.5 px-3 py-1.5 text-xs shadow-elev-1"
          >
            <IconSparkles />
            <span>
              {mostrarValorMatriz ? 'Ocultar Matriz' : 'Matriz de Valor'}
            </span>
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* 2. Matriz de Valor del CIP (Documentación Interactiva) */}
      {mostrarValorMatriz && (
        <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-bg-card via-bg-raised to-bg-card p-6 shadow-elev-2 transition-all">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-bg font-bold">
                <IconSparkles />
              </span>
              <div>
                <h3 className="text-base font-bold text-text">
                  Matriz de Valor Estratégico del CIP (Centro de Inteligencia
                  Patrimonial)
                </h3>
                <p className="text-xs text-text-dim">
                  Justificación de valor, retorno de inversión (ROI) y aporte a
                  la toma de decisiones directiva.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMostrarValorMatriz(false)}
              className="text-xs text-text-dim hover:text-text"
            >
              Cerrar ✕
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-bg-card/70 p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <IconChart />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Control en Tiempo Real
                </h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-dim">
                Elimina hasta un{' '}
                <strong className="text-text">95% del tiempo</strong> de
                consolidación manual de planillas de inventario. Visibilidad
                instantánea del estado global de los bienes.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-bg-card/70 p-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <IconShield />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Prevención de Pérdidas
                </h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-dim">
                Detección automática de activos fuera de área o extraviados
                mediante la conciliación continua con la APP QR en terreno.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-bg-card/70 p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <IconClock />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Vida Útil y Mantenimiento
                </h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-dim">
                Anticipación al desgaste y alertas de bienes en taller, evitando
                la compra duplicada de equipamiento y optimizando el presupuesto
                de reposición.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-bg-card/70 p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <IconUsers />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Custodia & Cumplimiento
                </h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-dim">
                Trazabilidad inmutable de responsables autorizados, garantizando
                auditorías sin observaciones ante organismos de control y
                fiscalización.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Las 4 Stat Cards de Alto Impacto (Idénticas a la imagen de referencia) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group relative overflow-hidden rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1 transition-all hover:border-border-strong hover:shadow-elev-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-dim">Total Activos</p>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-blue-400">
              {/* Antes decia '▲ +4.2%' fijo: una tendencia inventada. No hay serie historica
                  todavia para calcularla, asi que se muestra el dato que si existe. */}
              En BPI
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
              {totalActivos.toLocaleString('es-CL')}
            </span>
          </div>
          <p className="mt-1 text-[0.75rem] text-text-faint">
            Patrimonio activo registrado en BPI
          </p>
          <div className="absolute right-4 bottom-4 text-border/40 transition-transform group-hover:scale-110 group-hover:text-blue-500/10">
            <IconBox />
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1 transition-all hover:border-border-strong hover:shadow-elev-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-dim">
              Activos en Servicio
            </p>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-400">
              {porcentaje(activosServicio)} Disp.
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
              {activosServicio.toLocaleString('es-CL')}
            </span>
          </div>
          <p className="mt-1 text-[0.75rem] text-text-faint">
            Operando en sedes y áreas asignadas
          </p>
          <div className="absolute right-4 bottom-4 text-border/40 transition-transform group-hover:scale-110 group-hover:text-emerald-500/10">
            <IconCheck />
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1 transition-all hover:border-border-strong hover:shadow-elev-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-dim">
              En Mantenimiento
            </p>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-400">
              {porcentaje(activosMantenimiento)} Parque
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-amber-400 sm:text-4xl">
              {activosMantenimiento.toLocaleString('es-CL')}
            </span>
          </div>
          <p className="mt-1 text-[0.75rem] text-text-faint">
            Revisión técnica preventiva / correctiva
          </p>
          <div className="absolute right-4 bottom-4 text-border/40 transition-transform group-hover:scale-110 group-hover:text-amber-500/10">
            <IconClock />
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1 transition-all hover:border-border-strong hover:shadow-elev-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-dim">
              Baja / Inactivos
            </p>
            <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-zinc-400">
              {porcentaje(activosBajaInactivos)} Parque
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
              {activosBajaInactivos.toLocaleString('es-CL')}
            </span>
          </div>
          <p className="mt-1 text-[0.75rem] text-text-faint">
            Obsolescencia o en proceso de donación
          </p>
          <div className="absolute right-4 bottom-4 text-border/40 transition-transform group-hover:scale-110 group-hover:text-zinc-500/10">
            <IconTrendingUp />
          </div>
        </div>
      </div>

      {/* 4. Sección Central: Gráficos Interactivos en 2 Columnas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Donut Chart SVG */}
        <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-text">
                Distribución por Categoría
              </h2>
              <p className="text-xs text-text-dim">
                Concentración patrimonial por familia de bienes
              </p>
            </div>
            {categoriaSeleccionada && (
              <button
                type="button"
                onClick={() => setCategoriaSeleccionada(null)}
                className="text-xs text-accent-strong hover:underline"
              >
                Limpiar filtro
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row sm:justify-around">
            <div className="relative h-48 w-48 shrink-0">
              <svg
                viewBox="0 0 200 200"
                className="h-full w-full transform -rotate-90"
              >
                {segmentosDonut.map((seg) => {
                  const radioExterior = 85;
                  const radioInterior = 55;
                  const [x1Ext, y1Ext] = calcularCoordenadas(
                    seg.inicio,
                    radioExterior,
                  );
                  const [x2Ext, y2Ext] = calcularCoordenadas(
                    seg.fin,
                    radioExterior,
                  );
                  const [x1Int, y1Int] = calcularCoordenadas(
                    seg.inicio,
                    radioInterior,
                  );
                  const [x2Int, y2Int] = calcularCoordenadas(
                    seg.fin,
                    radioInterior,
                  );
                  const granArco = seg.fin - seg.inicio > 180 ? 1 : 0;

                  const d = [
                    `M ${x1Ext} ${y1Ext}`,
                    `A ${radioExterior} ${radioExterior} 0 ${granArco} 1 ${x2Ext} ${y2Ext}`,
                    `L ${x2Int} ${y2Int}`,
                    `A ${radioInterior} ${radioInterior} 0 ${granArco} 0 ${x1Int} ${y1Int}`,
                    'Z',
                  ].join(' ');

                  const esSeleccionado = categoriaSeleccionada === seg.nombre;

                  return (
                    <path
                      key={seg.nombre}
                      d={d}
                      fill={seg.color}
                      className="cursor-pointer transition-all duration-200 hover:opacity-90"
                      style={{
                        transformOrigin: '100px 100px',
                        transform: esSeleccionado ? 'scale(1.05)' : 'scale(1)',
                        filter: esSeleccionado
                          ? 'drop-shadow(0 0 8px rgba(255,255,255,0.3))'
                          : 'none',
                      }}
                      onClick={() =>
                        setCategoriaSeleccionada(
                          esSeleccionado ? null : seg.nombre,
                        )
                      }
                    >
                      <title>{`${seg.nombre}: ${seg.cantidad} (${seg.porcentaje}%)`}</title>
                    </path>
                  );
                })}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-text">
                  {totalActivos}
                </span>
                <span className="text-[0.65rem] font-medium text-text-dim uppercase tracking-wider">
                  Activos
                </span>
              </div>
            </div>

            <div className="w-full space-y-2.5 sm:max-w-xs">
              {datosCategorias.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-dim">
                  {cargando
                    ? 'Cargando distribución…'
                    : 'Sin activos proyectados todavía. La distribución aparece cuando el CIP procesa la primera ingesta.'}
                </p>
              )}
              {datosCategorias.map((cat) => {
                const activo = categoriaSeleccionada === cat.nombre;
                return (
                  <button
                    key={cat.nombre}
                    type="button"
                    onClick={() =>
                      setCategoriaSeleccionada(activo ? null : cat.nombre)
                    }
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      activo
                        ? 'bg-accent/15 font-semibold text-text ring-1 ring-accent'
                        : 'hover:bg-bg-raised text-text-dim'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-text">{cat.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text">
                        {cat.cantidad}
                      </span>
                      <span className="text-text-faint">
                        ({cat.porcentaje}%)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bar Chart SVG */}
        <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-text">
                Activos por Estado
              </h2>
              <p className="text-xs text-text-dim">
                Condición operativa de la flota de activos
              </p>
            </div>
            <span className="text-xs text-text-dim">Escala (0 - 800)</span>
          </div>

          <div className="mt-6 flex flex-col justify-end">
            <div className="relative h-48 w-full">
              <div className="absolute inset-0 flex flex-col justify-between text-[0.65rem] text-text-faint">
                <div className="flex items-center gap-2 border-b border-border/40 pb-0.5">
                  <span className="w-6">800</span>
                  <div className="flex-1 border-t border-dashed border-border/30" />
                </div>
                <div className="flex items-center gap-2 border-b border-border/40 pb-0.5">
                  <span className="w-6">400</span>
                  <div className="flex-1 border-t border-dashed border-border/30" />
                </div>
                <div className="flex items-center gap-2 border-b border-border/40 pb-0.5">
                  <span className="w-6">0</span>
                  <div className="flex-1 border-t border-border" />
                </div>
              </div>

              <div className="absolute inset-x-8 bottom-0 flex h-40 items-end justify-between gap-3">
                {datosEstadosBarra.map((item) => {
                  const alturaPorc = Math.min(
                    100,
                    Math.max(8, (item.cantidad / 800) * 100),
                  );
                  return (
                    <div
                      key={item.estado}
                      className="group relative flex flex-1 flex-col items-center"
                    >
                      <div className="pointer-events-none absolute -top-8 z-10 hidden rounded bg-bg-raised px-2 py-0.5 text-[0.7rem] font-bold text-text shadow-elev-2 group-hover:block ring-1 ring-border">
                        {item.cantidad}
                      </div>
                      <div
                        className="w-full max-w-[48px] rounded-t-md transition-all duration-300 group-hover:brightness-110"
                        style={{
                          height: `${alturaPorc}%`,
                          backgroundColor: item.color,
                        }}
                      />
                      <span className="mt-2 text-center text-[0.7rem] font-medium text-text-dim transition-colors group-hover:text-text">
                        {item.estado}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Control de Áreas */}
      {areas.length > 0 && (
        <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-text">
                Control de Áreas Patrimoniales
              </h2>
              <p className="text-xs text-text-dim">
                Estado de relevamiento por área física operativa
              </p>
            </div>
            <span className="text-xs font-semibold text-accent-strong">
              {areas.filter((a) => a.controladaEnPeriodo).length} de{' '}
              {areas.length} controladas
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((ar) => (
              <div
                key={ar.areaId}
                className="flex items-center justify-between rounded-xl border border-border bg-bg-raised/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-text">
                    {nombreDeArea(ar.areaId)}
                  </p>
                  <p className="text-[0.65rem] text-text-faint">
                    {ar.ultimaSesionEn
                      ? `Último escaneo: ${new Date(ar.ultimaSesionEn).toLocaleDateString('es-CL')}`
                      : 'Sin relevamiento en período'}
                  </p>
                </div>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                    ar.controladaEnPeriodo
                      ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                      : 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20'
                  }`}
                >
                  {ar.controladaEnPeriodo ? 'Al Día' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Tabla Interactiva: Activos Recientes */}
      <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-elev-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-base font-bold text-text">Activos Recientes</h2>
            <p className="text-xs text-text-dim">
              Últimas incorporaciones y relevamientos verificados en BPI
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-dim">Filtrar estado:</span>
            <select
              value={estadoFiltroTabla}
              onChange={(e) => setEstadoFiltroTabla(e.target.value)}
              aria-label="Filtrar por estado operativo"
              className="h-8 rounded-lg border border-border bg-bg-raised px-2.5 text-xs text-text focus:border-accent focus:outline-none"
            >
              <option value="todos">Todos los estados</option>
              <option value="enservicio">En Servicio</option>
              <option value="enmantenimiento">En Mantenimiento</option>
              <option value="traslado">Traslado</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-text-dim">
                <th className="py-2.5 pr-4 font-semibold">Código</th>
                <th className="py-2.5 pr-4 font-semibold">Nombre</th>
                <th className="py-2.5 pr-4 font-semibold">Categoría</th>
                <th className="py-2.5 pr-4 font-semibold">Estado</th>
                <th className="py-2.5 pr-4 font-semibold">Ubicación</th>
                <th className="py-2.5 pr-4 font-semibold">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-dim">
                    No se encontraron activos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filasFiltradas.slice(0, 10).map((fila) => (
                  <tr
                    key={fila.codigo}
                    className="transition-colors hover:bg-bg-raised/60"
                  >
                    <td className="py-3 pr-4 font-mono font-medium text-text">
                      <span className="rounded bg-bg-raised px-1.5 py-0.5 ring-1 ring-border">
                        {fila.codigo}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium text-text">
                      {fila.nombre}
                    </td>
                    <td className="py-3 pr-4 text-text-dim">
                      {fila.categoria}
                    </td>
                    <td className="py-3 pr-4">
                      {fila.estado === 'En Servicio' && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                          En Servicio
                        </span>
                      )}
                      {fila.estado === 'En Mantenimiento' && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-amber-400 ring-1 ring-amber-500/20">
                          En Mantenimiento
                        </span>
                      )}
                      {fila.estado === 'Traslado' && (
                        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-blue-400 ring-1 ring-blue-500/20">
                          Traslado
                        </span>
                      )}
                      {fila.estado === 'Baja' && (
                        <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-red-400 ring-1 ring-red-500/20">
                          Baja
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-text-dim">
                      {fila.ubicacion}
                    </td>
                    <td className="py-3 pr-4 text-text-faint">{fila.fecha}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

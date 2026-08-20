import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  dashboardClient,
  type ActivoFueraDeArea,
  type ActivoNoLocalizado,
  type CategoriaResumen,
  type Cobertura,
  type ControlArea,
  type EstadoResumen,
  type Incidencia,
  type SyncInfo,
  type VeredictoSesion,
} from '@/lib/dashboard-client';
import { Alert, Badge, Card, Input, Label, StatCard } from '@/components/ui';
import { IconBox, IconChart, IconMapPin } from '@/components/icons';

// RF-09 (DOC-019) — dashboard ejecutivo del Directivo, solo lectura. Drill-down
// Organización→Área→Categoría (DOC-018 6): elegir un área en "Áreas controladas" filtra
// Sesiones/Fuera de área/Categorías del resto de la página — sin selector de Sede (DOC-018 2.7,
// no resoluble desde las APIs de lectura de CORE disponibles hoy). Movido acá desde ccp/ por
// DOC-022 3 — el Directivo ya no entra a CCP.

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL');
}

// Paleta acotada de BRAND.md, ciclada — sin librería de gráficos nueva (YAGNI): un pie chart SVG
// chico no lo justifica.
const PALETA_CATEGORIAS = [
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-destructive)',
  'var(--color-accent-strong)',
  'var(--color-text-dim)',
];

function PieCategorias({ categorias }: { categorias: CategoriaResumen[] }) {
  const total = categorias.reduce((sum, c) => sum + c.cantidad, 0);
  if (total === 0) {
    return <p className="text-sm text-text-dim">Sin activos para graficar.</p>;
  }

  let anguloAcumulado = 0;
  const segmentos = categorias.map((categoria, i) => {
    const fraccion = categoria.cantidad / total;
    const inicio = anguloAcumulado;
    anguloAcumulado += fraccion * 360;
    return {
      categoria,
      inicio,
      fin: anguloAcumulado,
      color: PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length],
    };
  });

  function puntoEnCirculo(angulo: number): [number, number] {
    const rad = ((angulo - 90) * Math.PI) / 180;
    return [50 + 50 * Math.cos(rad), 50 + 50 * Math.sin(rad)];
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox="0 0 100 100" className="h-40 w-40 shrink-0">
        {segmentos.map(({ categoria, inicio, fin, color }) => {
          const [x1, y1] = puntoEnCirculo(inicio);
          const [x2, y2] = puntoEnCirculo(fin);
          const grandeArco = fin - inicio > 180 ? 1 : 0;
          return (
            <path
              key={`${categoria.areaId}-${categoria.familia}`}
              d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${grandeArco} 1 ${x2} ${y2} Z`}
              fill={color}
            />
          );
        })}
      </svg>
      <ul className="space-y-1 text-sm">
        {segmentos.map(({ categoria, color }) => (
          <li
            key={`${categoria.areaId}-${categoria.familia}`}
            className="flex items-center gap-2"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-text">{categoria.familia}</span>
            <span className="text-text-dim">({categoria.cantidad})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Barras horizontales simples para "Estado de los AFT" — mismo criterio que PieCategorias: SVG a
// mano, sin sumar una librería de gráficos para un solo chart chico (YAGNI).
function BarEstados({ estados }: { estados: EstadoResumen[] }) {
  if (estados.length === 0) {
    return <p className="text-sm text-text-dim">Sin activos para graficar.</p>;
  }
  const max = Math.max(...estados.map((e) => e.cantidad), 1);
  return (
    <ul className="space-y-3">
      {estados.map((estado) => (
        <li key={estado.estado} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-text-dim">
            {estado.estado}
          </span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-raised">
            <span
              className="block h-full rounded-full bg-accent"
              style={{
                width: `${Math.max((estado.cantidad / max) * 100, 4)}%`,
              }}
            />
          </span>
          <span className="w-8 shrink-0 text-right font-mono text-xs text-text">
            {estado.cantidad}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EstadoSync({ sync }: { sync: SyncInfo | null }) {
  if (!sync) return null;
  if (sync.alDia) {
    return <Badge>al día</Badge>;
  }
  return (
    <span className="text-xs text-warning">
      Últimos datos conocidos
      {sync.actualizadoEn
        ? ` — actualizado ${formatFechaHora(sync.actualizadoEn)}`
        : ''}
    </span>
  );
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';
  const areaId = searchParams.get('areaId') ?? undefined;

  const [error, setError] = useState<string | null>(null);
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [areas, setAreas] = useState<ControlArea[] | null>(null);
  const [sesiones, setSesiones] = useState<VeredictoSesion[] | null>(null);
  const [fueraDeArea, setFueraDeArea] = useState<ActivoFueraDeArea[] | null>(
    null,
  );
  const [noLocalizados, setNoLocalizados] = useState<
    ActivoNoLocalizado[] | null
  >(null);
  const [incidencias, setIncidencias] = useState<Incidencia[] | null>(null);
  const [codigoQrFiltro, setCodigoQrFiltro] = useState('');
  const [estados, setEstados] = useState<EstadoResumen[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaResumen[] | null>(null);

  useEffect(() => {
    if (!organizacionId) return;
    let cancelled = false;
    setError(null);
    Promise.all([
      dashboardClient.getCobertura(organizacionId),
      dashboardClient.getAreas(organizacionId),
      dashboardClient.getEstadoActivos(organizacionId),
      dashboardClient.getNoLocalizados(organizacionId),
    ])
      .then(([coberturaRes, areasRes, estadosRes, noLocalizadosRes]) => {
        if (cancelled) return;
        setCobertura(coberturaRes);
        setAreas(areasRes.areas);
        setEstados(estadosRes.estados);
        setNoLocalizados(noLocalizadosRes.items);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, [organizacionId]);

  useEffect(() => {
    if (!organizacionId) return;
    let cancelled = false;
    Promise.all([
      dashboardClient.getSesiones(organizacionId, areaId),
      dashboardClient.getFueraDeArea(organizacionId, areaId),
      dashboardClient.getCategorias(organizacionId, areaId),
    ])
      .then(([sesionesRes, fueraDeAreaRes, categoriasRes]) => {
        if (cancelled) return;
        setSesiones(sesionesRes.items);
        setFueraDeArea(fueraDeAreaRes.items);
        setCategorias(categoriasRes.categorias);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, [organizacionId, areaId]);

  useEffect(() => {
    if (!organizacionId) return;
    let cancelled = false;
    dashboardClient
      .getIncidencias(organizacionId, codigoQrFiltro || undefined)
      .then((res) => {
        if (!cancelled) setIncidencias(res.items);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, [organizacionId, codigoQrFiltro]);

  function seleccionarArea(nuevaAreaId: string) {
    const next = new URLSearchParams(searchParams);
    if (areaId === nuevaAreaId) {
      next.delete('areaId');
    } else {
      next.set('areaId', nuevaAreaId);
    }
    setSearchParams(next);
  }

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al inicio y elegí una organización.
      </Alert>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-accent-strong">Dashboard</h1>
        <EstadoSync sync={cobertura} />
      </div>
      {error && <Alert>{error}</Alert>}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Activos registrados"
          value={cobertura?.activosRegistrados ?? '—'}
          icon={<IconBox />}
        />
        <StatCard
          label="Activos escaneados"
          value={cobertura?.activosEscaneados ?? '—'}
          icon={<IconChart />}
          tone="success"
        />
        <StatCard
          label="% Cobertura"
          value={
            cobertura
              ? `${Math.round(cobertura.porcentajeCobertura * 100)}%`
              : '—'
          }
          icon={<IconMapPin />}
          tone="warning"
        />
      </div>

      <Card className="mb-8">
        <h2 className="mb-4 font-medium text-text">Áreas controladas</h2>
        {!areas && <p className="text-sm text-text-dim">Cargando…</p>}
        {areas?.length === 0 && (
          <p className="text-sm text-text-dim">Sin áreas todavía.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {areas?.map((area) => (
            <button
              key={area.areaId}
              type="button"
              onClick={() => seleccionarArea(area.areaId)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                areaId === area.areaId
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-border-strong'
              }`}
            >
              <span className="block font-medium text-text">{area.areaId}</span>
              <span className="text-xs text-text-dim">
                {area.controladaEnPeriodo ? 'Controlada' : 'Pendiente'}
                {area.ultimaSesionEn
                  ? ` — ${formatFechaHora(area.ultimaSesionEn)}`
                  : ''}
              </span>
            </button>
          ))}
        </div>
        {areaId && (
          <p className="mt-3 text-xs text-text-dim">
            Filtrando por área <span className="font-mono">{areaId}</span> —
            clic de nuevo para quitar el filtro.
          </p>
        )}
      </Card>

      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium text-text">Sesiones de inventario</h2>
          {!sesiones && <p className="text-sm text-text-dim">Cargando…</p>}
          {sesiones?.length === 0 && (
            <p className="text-sm text-text-dim">
              Sin sesiones en este filtro.
            </p>
          )}
          {sesiones && sesiones.length > 0 && (
            <ul className="space-y-2">
              {sesiones.map((sesion) => (
                <li
                  key={sesion.sesionId}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="text-text-dim">
                    {formatFechaHora(sesion.fechaCierre)}
                  </span>
                  <span className="text-text-dim">{sesion.areaId}</span>
                  <Badge>{sesion.veredicto}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-medium text-text">Estado de los AFT</h2>
          {!estados && <p className="text-sm text-text-dim">Cargando…</p>}
          {estados && estados.length === 0 && (
            <p className="text-sm text-text-dim">Sin activos para graficar.</p>
          )}
          {estados && estados.length > 0 && <BarEstados estados={estados} />}
        </Card>
      </div>

      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium text-text">Activos fuera de área</h2>
          {!fueraDeArea && <p className="text-sm text-text-dim">Cargando…</p>}
          {fueraDeArea?.length === 0 && (
            <p className="text-sm text-text-dim">Ninguno en este filtro.</p>
          )}
          {fueraDeArea && fueraDeArea.length > 0 && (
            <ul className="space-y-2 text-sm">
              {fueraDeArea.map((activo) => (
                <li
                  key={activo.codigoQr}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span className="font-mono text-xs">{activo.codigoQr}</span>
                  <span className="text-text-dim">
                    {activo.areaRealId} → {activo.areaEsperadaId}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-medium text-text">Activos no localizados</h2>
          {!noLocalizados && <p className="text-sm text-text-dim">Cargando…</p>}
          {noLocalizados?.length === 0 && (
            <p className="text-sm text-text-dim">Ninguno todavía.</p>
          )}
          {noLocalizados && noLocalizados.length > 0 && (
            <ul className="space-y-2 text-sm">
              {noLocalizados.map((activo) => (
                <li
                  key={activo.codigoQr}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span className="font-mono text-xs">{activo.codigoQr}</span>
                  <span className="text-text-dim">
                    desde {formatFechaHora(activo.desdeEn)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mb-8">
        <h2 className="mb-4 font-medium text-text">Incidencias</h2>
        <div className="mb-4 max-w-xs">
          <Label htmlFor="codigoQrFiltro">Filtrar por código QR</Label>
          <Input
            id="codigoQrFiltro"
            value={codigoQrFiltro}
            onChange={(e) => setCodigoQrFiltro(e.target.value)}
            placeholder="QR-0001"
          />
        </div>
        {!incidencias && <p className="text-sm text-text-dim">Cargando…</p>}
        {incidencias?.length === 0 && (
          <p className="text-sm text-text-dim">Sin incidencias.</p>
        )}
        {incidencias && incidencias.length > 0 && (
          <ul className="space-y-2 text-sm">
            {incidencias.map((incidencia) => (
              <li
                key={`${incidencia.sesionId}-${incidencia.codigoQr}`}
                className="rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">
                    {incidencia.codigoQr}
                  </span>
                  <span className="text-xs text-text-dim">
                    {formatFechaHora(incidencia.fecha)}
                  </span>
                </div>
                <p className="mt-1 text-text-dim">{incidencia.observaciones}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-medium text-text">Categorías</h2>
        {!categorias && <p className="text-sm text-text-dim">Cargando…</p>}
        {categorias && <PieCategorias categorias={categorias} />}
      </Card>
    </div>
  );
}

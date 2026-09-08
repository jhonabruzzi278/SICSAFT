import type { Area } from '@/lib/cis-client';
import type { SeccionCip } from '../types';
import { Button } from '@/components/ui';
import { IconRefresh, IconSearch, IconSparkles } from '@/components/icons';

interface CipHeaderProps {
  seccionActiva: SeccionCip;
  terminoBusqueda: string;
  onCambiarBusqueda: (val: string) => void;
  areaFiltro: string;
  onCambiarAreaFiltro: (val: string) => void;
  areasReales: Area[];
  cargando: boolean;
  onActualizar: () => void;
  onExportarCsv: () => void;
  mostrarValorMatriz: boolean;
  onToggleValorMatriz: () => void;
}

export function CipHeader({
  seccionActiva,
  terminoBusqueda,
  onCambiarBusqueda,
  areaFiltro,
  onCambiarAreaFiltro,
  areasReales,
  cargando,
  onActualizar,
  onExportarCsv,
  mostrarValorMatriz,
  onToggleValorMatriz,
}: CipHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {seccionActiva === 'activos'
            ? 'Catálogo de Activos Fijos (AFT)'
            : 'Resumen Ejecutivo'}
        </h1>
        <p className="mt-0.5 text-xs text-text-dim">
          {seccionActiva === 'activos'
            ? 'Consulta consolidada de bienes con especificaciones técnicas, ubicación, custodia y valuación contable.'
            : 'Indicadores globales de inventario, cobertura y distribución patrimonial.'}
        </p>
      </div>

      {/* Acciones y Controles de Filtro */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            placeholder="Buscar en el catálogo…"
            value={terminoBusqueda}
            onChange={(e) => onCambiarBusqueda(e.target.value)}
            className="h-8 w-44 rounded-lg border border-border bg-bg-card pr-3 pl-8 text-xs text-text placeholder-text-faint transition-all focus:w-60 focus:border-accent focus:outline-none"
          />
        </div>

        {/* Selector de Área */}
        {areasReales.length > 0 && (
          <select
            value={areaFiltro}
            onChange={(e) => onCambiarAreaFiltro(e.target.value)}
            aria-label="Filtrar por área"
            className="h-8 rounded-lg border border-border bg-bg-card px-2.5 text-xs text-text focus:border-accent focus:outline-none"
          >
            <option value="todas">Todas las áreas</option>
            {areasReales.map((ar) => (
              <option key={ar.id} value={ar.id}>
                {ar.nombre}
              </option>
            ))}
          </select>
        )}

        <Button
          variant="secondary"
          onClick={onActualizar}
          disabled={cargando}
          className="gap-1.5 px-3 py-1 text-xs !h-8"
          title="Actualizar datos"
        >
          <IconRefresh className={cargando ? 'animate-spin' : ''} />
          <span>Actualizar</span>
        </Button>

        {seccionActiva === 'activos' && (
          <Button
            variant="primary"
            onClick={onExportarCsv}
            className="gap-1 px-3 py-1 text-xs !h-8 font-semibold"
          >
            <span>📥 Exportar CSV</span>
          </Button>
        )}

        {seccionActiva === 'resumen' && (
          <Button
            variant="primary"
            onClick={onToggleValorMatriz}
            className="gap-1 px-3 py-1 text-xs !h-8"
          >
            <IconSparkles />
            <span>{mostrarValorMatriz ? 'Ocultar Matriz' : 'Matriz de Valor'}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

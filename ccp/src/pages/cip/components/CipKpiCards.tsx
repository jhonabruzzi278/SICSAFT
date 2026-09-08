import type { CipKpiResumen } from '../types';
import { IconBox, IconCheck, IconShield, IconWrench } from '@/components/icons';

interface CipKpiCardsProps {
  kpis: CipKpiResumen;
  modo: 'resumen' | 'catalogo';
}

export function CipKpiCards({ kpis, modo }: CipKpiCardsProps) {
  if (modo === 'catalogo') {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-bg-card p-3">
          <span className="text-[10px] font-semibold text-text-dim uppercase">Total Bienes</span>
          <p className="text-xl font-extrabold text-text">{kpis.totalActivos}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-3">
          <span className="text-[10px] font-semibold text-text-dim uppercase">Valor Bruto</span>
          <p className="text-xl font-extrabold text-text">${(kpis.valorTotalBruto / 1000000).toFixed(1)}M</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-3">
          <span className="text-[10px] font-semibold text-text-dim uppercase">Valor Neto</span>
          <p className="text-xl font-extrabold text-emerald-400">${(kpis.valorTotalNeto / 1000000).toFixed(1)}M</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card p-3">
          <span className="text-[10px] font-semibold text-text-dim uppercase">Operatividad</span>
          <p className="text-xl font-extrabold text-accent-strong">
            {kpis.porcentajeOperatividad.toFixed(1)}%
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-dim uppercase">Total Activos</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <IconBox />
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-text">
            {kpis.totalActivos.toLocaleString('es-CL')}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-text-dim">Registrados en BPI</p>
      </div>

      <div className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-dim uppercase">En Servicio</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <IconCheck />
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-emerald-400">
            {kpis.activosServicio.toLocaleString('es-CL')}
          </span>
          <span className="text-xs text-emerald-400">
            ({kpis.porcentajeOperatividad.toFixed(1)}%)
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-text-dim">Condición operativa</p>
      </div>

      <div className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-dim uppercase">En Mantenimiento</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <IconWrench />
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-amber-400">
            {kpis.activosMantenimiento.toLocaleString('es-CL')}
          </span>
          <span className="text-xs text-amber-400">
            ({kpis.totalActivos > 0 ? ((kpis.activosMantenimiento / kpis.totalActivos) * 100).toFixed(1) : 0}%)
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-text-dim">Preventivo / correctivo</p>
      </div>

      <div className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-dim uppercase">Baja / Inactivos</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
            <IconShield />
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-red-400">
            {kpis.activosBaja.toLocaleString('es-CL')}
          </span>
          <span className="text-xs text-red-400">
            ({kpis.totalActivos > 0 ? ((kpis.activosBaja / kpis.totalActivos) * 100).toFixed(1) : 0}%)
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-text-dim">Desincorporación</p>
      </div>
    </div>
  );
}

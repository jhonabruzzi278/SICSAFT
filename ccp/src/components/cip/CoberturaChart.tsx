import React from 'react';
import { Badge } from '@/components/ui';
import { IconBox, IconTrendingUp } from '@/components/icons';
import type { CategoriaResumen, Cobertura, EstadoResumen } from '@/lib/dashboard-client';

export interface CoberturaChartProps {
  cobertura: Cobertura | null;
  categorias: CategoriaResumen[];
  estados: EstadoResumen[];
  paletaCategorias: string[];
}

export const CoberturaChart: React.FC<CoberturaChartProps> = ({
  cobertura,
  categorias,
  estados,
  paletaCategorias,
}) => {
  const pct = cobertura?.porcentajeCobertura ?? 0;
  const strokeDashoffset = 283 - (283 * pct) / 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Gauge / Anillo de Cobertura */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <IconTrendingUp className="h-4 w-4 text-indigo-600" />
              Cobertura Global de Inventario
            </h3>
            <Badge variant="outline" className="text-xs">
              Conciliación Física
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Proporción de bienes escaneados y confirmados en terreno respecto al padrón total.
          </p>
        </div>

        <div className="my-6 flex flex-col items-center justify-center">
          <div className="relative h-44 w-44">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                className="text-slate-100"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
                r="45"
                cx="50"
                cy="50"
              />
              <circle
                className="text-indigo-600 transition-all duration-1000 ease-out"
                strokeWidth="10"
                strokeDasharray="283"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="45"
                cx="50"
                cy="50"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {pct.toFixed(1)}%
              </span>
              <span className="text-xs font-medium text-slate-500">Completitud</span>
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              {cobertura?.bienesControlados?.toLocaleString() ?? 0}
            </span>{' '}
            de{' '}
            <span className="font-semibold text-slate-900">
              {cobertura?.totalBienes?.toLocaleString() ?? 0}
            </span>{' '}
            bienes inventariados
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex justify-between">
          <span>Último corte de agregación</span>
          <span className="font-medium text-slate-700">En tiempo real</span>
        </div>
      </div>

      {/* Desglose por Categorías */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <IconBox className="h-4 w-4 text-blue-600" />
              Distribución por Categorías
            </h3>
            <span className="text-xs text-slate-500">{categorias.length} familias</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Volumen y ponderación del patrimonio por tipología de activo.
          </p>
        </div>

        <div className="my-4 space-y-3">
          {categorias.slice(0, 5).map((cat, idx) => {
            const color = paletaCategorias[idx % paletaCategorias.length];
            return (
              <div key={cat.categoria} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full inline-block"
                      style={{ backgroundColor: color }}
                    />
                    {cat.categoria}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {cat.total.toLocaleString()} ({cat.porcentaje.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, cat.porcentaje))}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
          {categorias.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400">
              No hay datos de categorías disponibles.
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex justify-between">
          <span>Total Familias Activas</span>
          <span className="font-semibold text-slate-700">{categorias.length}</span>
        </div>
      </div>

      {/* Estados Operativos */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <IconBox className="h-4 w-4 text-emerald-600" />
              Estado Operativo de Bienes
            </h3>
            <span className="text-xs text-slate-500">{estados.length} estados</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Disponibilidad física de activos para la continuidad operativa.
          </p>
        </div>

        <div className="my-4 space-y-3">
          {estados.map((est) => (
            <div
              key={est.estado}
              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                <span className="text-xs font-medium text-slate-700">{est.estado}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-900 block">
                  {est.total.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">{est.porcentaje.toFixed(1)}%</span>
              </div>
            </div>
          ))}
          {estados.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400">
              No hay estados declarados disponibles.
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex justify-between">
          <span>Garantía de Operación</span>
          <span className="font-semibold text-emerald-600">Activo</span>
        </div>
      </div>
    </div>
  );
};

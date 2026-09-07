import React from 'react';
import { Button } from '@/components/ui';
import { IconSearch } from '@/components/icons';
import type { Area } from '@/lib/cis-client';

export interface FiltrosCipProps {
  rango: 'semana' | 'mes' | 'año' | 'todo';
  setRango: (r: 'semana' | 'mes' | 'año' | 'todo') => void;
  areaFiltro: string;
  setAreaFiltro: (a: string) => void;
  areas: Area[];
  busqueda: string;
  setBusqueda: (b: string) => void;
  categoriaFiltro: string;
  setCategoriaFiltro: (c: string) => void;
  categoriasLista: string[];
}

export const FiltrosCip: React.FC<FiltrosCipProps> = ({
  rango,
  setRango,
  areaFiltro,
  setAreaFiltro,
  areas,
  busqueda,
  setBusqueda,
  categoriaFiltro,
  setCategoriaFiltro,
  categoriasLista,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1">Rango Temporal:</span>
        {(['semana', 'mes', 'año', 'todo'] as const).map((r) => (
          <Button
            key={r}
            variant={rango === r ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRango(r)}
            className="capitalize text-xs h-8"
          >
            {r === 'todo' ? 'Histórico Completo' : `Último ${r}`}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Filtro de Área */}
        <select
          value={areaFiltro}
          onChange={(e) => setAreaFiltro(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
        >
          <option value="todas">Todas las Áreas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>

        {/* Filtro de Categoría */}
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
        >
          <option value="todas">Todas las Categorías</option>
          {categoriasLista.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Búsqueda rápida */}
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código o bien..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-8 w-44 sm:w-56 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};

import type { CategoriaSegmento, EstadoBarraData } from '../types';

interface CipChartsProps {
  totalActivos: number;
  datosCategorias: CategoriaSegmento[];
  segmentosDonut: CategoriaSegmento[];
  categoriaSeleccionada: string | null;
  onSeleccionarCategoria: (cat: string | null) => void;
  datosEstadosBarra: EstadoBarraData[];
}

function calcularCoordenadas(grados: number, radio: number) {
  const radianes = ((grados - 90) * Math.PI) / 180.0;
  return [
    100 + radio * Math.cos(radianes),
    100 + radio * Math.sin(radianes),
  ];
}

export function CipDonutChart({
  totalActivos,
  datosCategorias,
  segmentosDonut,
  categoriaSeleccionada,
  onSeleccionarCategoria,
}: Omit<CipChartsProps, 'datosEstadosBarra'>) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <h2 className="text-sm font-bold text-text">Activos por Categoría</h2>
        <span className="text-xs text-text-dim">Total: {totalActivos}</span>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center gap-5 sm:flex-row">
        <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
          <svg viewBox="0 0 200 200" className="h-full w-full transform -rotate-90">
            {segmentosDonut.map((seg) => {
              const radioExterior = 85;
              const radioInterior = 55;
              const inicio = seg.inicio ?? 0;
              const fin = seg.fin ?? 0;
              const [x1Ext, y1Ext] = calcularCoordenadas(inicio, radioExterior);
              const [x2Ext, y2Ext] = calcularCoordenadas(fin, radioExterior);
              const [x1Int, y1Int] = calcularCoordenadas(inicio, radioInterior);
              const [x2Int, y2Int] = calcularCoordenadas(fin, radioInterior);
              const granArco = fin - inicio > 180 ? 1 : 0;

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
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => onSeleccionarCategoria(esSeleccionado ? null : seg.nombre)}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-extrabold text-text">{totalActivos}</span>
            <span className="text-[10px] text-text-dim uppercase">Activos</span>
          </div>
        </div>

        <div className="w-full space-y-1.5 sm:max-w-xs">
          {datosCategorias.map((cat) => {
            const activo = categoriaSeleccionada === cat.nombre;
            return (
              <button
                key={cat.nombre}
                type="button"
                onClick={() => onSeleccionarCategoria(activo ? null : cat.nombre)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
                  activo ? 'bg-accent/15 font-semibold text-text' : 'hover:bg-bg-raised text-text-dim'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
                  <span>{cat.nombre}</span>
                </div>
                <span className="font-semibold text-text">{cat.cantidad} ({cat.porcentaje}%)</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CipBarChart({
  datosEstadosBarra,
}: {
  datosEstadosBarra: EstadoBarraData[];
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <h2 className="text-sm font-bold text-text">Activos por Estado</h2>
        <span className="text-xs text-text-dim">Condición operativa</span>
      </div>

      <div className="mt-4 flex flex-col justify-end">
        <div className="relative h-40 w-full">
          <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-text-faint">
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

          <div className="absolute inset-x-6 bottom-0 flex h-32 items-end justify-between gap-3">
            {datosEstadosBarra.map((item) => {
              const alturaPorc = Math.min(100, Math.max(8, (item.cantidad / 800) * 100));
              return (
                <div key={item.estado} className="flex flex-1 flex-col items-center">
                  <div
                    className="w-full max-w-[40px] rounded-t transition-all"
                    style={{ height: `${alturaPorc}%`, backgroundColor: item.color }}
                  />
                  <span className="mt-1.5 text-center text-[10px] text-text-dim truncate max-w-full">
                    {item.estado} ({item.cantidad})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CipValorMatrix({
  valorTotalBruto,
  valorTotalNeto,
}: {
  valorTotalBruto: number;
  valorTotalNeto: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-sm font-bold text-text">Valuación Patrimonial Consolidada</h2>
        <span className="text-xs font-mono text-accent-strong">CLP ($)</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-bg-raised p-3">
          <span className="text-xs text-text-dim">Valor Bruto</span>
          <p className="mt-0.5 text-xl font-extrabold text-text">${valorTotalBruto.toLocaleString('es-CL')}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-raised p-3">
          <span className="text-xs text-text-dim">Depreciación Acumulada</span>
          <p className="mt-0.5 text-xl font-extrabold text-amber-400">${(valorTotalBruto - valorTotalNeto).toLocaleString('es-CL')}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-raised p-3">
          <span className="text-xs text-text-dim">Patrimonio Neto Activo</span>
          <p className="mt-0.5 text-xl font-extrabold text-accent-strong">${valorTotalNeto.toLocaleString('es-CL')}</p>
        </div>
      </div>
    </div>
  );
}

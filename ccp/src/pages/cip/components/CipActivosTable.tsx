import type { ActivoFilaAft } from '../types';
import { Badge, Button } from '@/components/ui';

interface CipActivosTableProps {
  filas: ActivoFilaAft[];
  activoSeleccionadoId?: string;
  onSeleccionarActivo: (activo: ActivoFilaAft) => void;
  esVistaResumen?: boolean;
}

export function CipActivosTable({
  filas,
  activoSeleccionadoId,
  onSeleccionarActivo,
  esVistaResumen = false,
}: CipActivosTableProps) {
  const filasAMostrar = esVistaResumen ? filas.slice(0, 8) : filas;

  return (
    <div className="rounded-xl border border-border bg-bg-card overflow-hidden shadow-sm">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="border-b border-border bg-bg-raised/70 text-text-dim font-semibold uppercase text-[10px] tracking-wider">
          <tr>
            <th className="px-3.5 py-2.5">Código / Activo</th>
            <th className="px-3.5 py-2.5 hidden sm:table-cell">Marca & Serie</th>
            <th className="px-3.5 py-2.5 hidden md:table-cell">Área & Custodio</th>
            <th className="px-3.5 py-2.5">Estado</th>
            <th className="px-3.5 py-2.5 text-right hidden lg:table-cell">Valor Libro</th>
            <th className="px-3.5 py-2.5 text-right">Ficha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {filasAMostrar.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-text-dim">
                No se encontraron activos con los filtros ingresados.
              </td>
            </tr>
          ) : (
            filasAMostrar.map((activo) => {
              const seleccionado = activoSeleccionadoId === activo.codigoQr;
              return (
                <tr
                  key={activo.codigoQr}
                  className={`transition-colors hover:bg-bg-raised/60 cursor-pointer ${
                    seleccionado ? 'bg-accent/10 font-medium' : ''
                  }`}
                  onClick={() => onSeleccionarActivo(activo)}
                >
                  {/* Código / Activo */}
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-bg-raised px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent-strong">
                        {activo.codigoQr}
                      </span>
                      <span className="font-semibold text-text truncate max-w-[200px] lg:max-w-xs block">
                        {activo.nombre}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-dim block mt-0.5 sm:hidden">
                      {activo.marca} · {activo.areaNombre}
                    </span>
                  </td>

                  {/* Marca & Serie */}
                  <td className="px-3.5 py-2.5 hidden sm:table-cell text-text-dim">
                    <span className="font-medium text-text block truncate max-w-[140px]">
                      {activo.marca} {activo.modelo}
                    </span>
                    <span className="font-mono text-[10px] text-text-faint truncate block">
                      {activo.serie}
                    </span>
                  </td>

                  {/* Área & Custodio */}
                  <td className="px-3.5 py-2.5 hidden md:table-cell text-text-dim">
                    <span className="font-medium text-text block truncate max-w-[160px]">
                      {activo.areaNombre}
                    </span>
                    <span className="text-[10px] text-text-faint truncate block">
                      {activo.responsableNombre}
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="px-3.5 py-2.5">
                    <Badge
                      variant={
                        activo.estado === 'En Servicio'
                          ? 'success'
                          : activo.estado === 'Baja'
                          ? 'error'
                          : 'warning'
                      }
                    >
                      {activo.estado}
                    </Badge>
                  </td>

                  {/* Valor Libro */}
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-400 hidden lg:table-cell">
                    ${activo.valorLibro.toLocaleString('es-CL')}
                  </td>

                  {/* Ficha */}
                  <td className="px-3.5 py-2.5 text-right">
                    <Button
                      variant="secondary"
                      className="!px-2.5 !py-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeleccionarActivo(activo);
                      }}
                    >
                      📋 Ver Ficha
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

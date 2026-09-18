import { useMemo } from 'react';
import type { Area } from '@/lib/cis-client';
import {
  ACENTO_DIRECCION,
  SIN_DIRECCION,
  agruparAreasPorDireccion,
} from './organigrama-utils';

// Rollup de solo-lectura pedido aparte del Organigrama: una fila por Dirección con el conteo de
// Departamentos y Áreas — mismo acento de color por índice que ya usa JerarquiaSection, para que
// el color de una Dirección sea el mismo en ambas secciones.
export function DireccionesSection({ areas }: { areas: Area[] | null }) {
  const direcciones = useMemo(() => {
    return agruparAreasPorDireccion(areas).map(
      ([direccion, areasDeDireccion]) => {
        const departamentos = new Set(
          areasDeDireccion
            .map((a) => a.departamento?.trim())
            .filter((d): d is string => Boolean(d)),
        );
        return {
          direccion,
          totalAreas: areasDeDireccion.length,
          totalDepartamentos: departamentos.size,
        };
      },
    );
  }, [areas]);

  if (direcciones.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-medium text-text">Direcciones</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-raised text-text-dim">
            <tr>
              <th className="px-4 py-2 font-medium">Dirección</th>
              <th className="px-4 py-2 font-medium">Departamentos</th>
              <th className="px-4 py-2 font-medium">Áreas</th>
            </tr>
          </thead>
          <tbody>
            {direcciones.map(
              ({ direccion, totalAreas, totalDepartamentos }, i) => {
                const esSinDireccion = direccion === SIN_DIRECCION;
                const acento = ACENTO_DIRECCION[i % ACENTO_DIRECCION.length];
                return (
                  <tr key={direccion} className="border-t border-border">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        {!esSinDireccion && (
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${acento.punto}`}
                          />
                        )}
                        <span
                          className={
                            esSinDireccion
                              ? 'text-text-dim'
                              : 'font-medium text-text'
                          }
                        >
                          {direccion}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-text-dim">
                      {totalDepartamentos}
                    </td>
                    <td className="px-4 py-2 text-text-dim">{totalAreas}</td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

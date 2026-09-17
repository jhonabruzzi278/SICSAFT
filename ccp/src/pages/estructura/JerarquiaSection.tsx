import { useMemo } from 'react';
import type { Area } from '@/lib/cis-client';
import {
  ACENTO_DIRECCION,
  SIN_DEPARTAMENTO,
  SIN_DIRECCION,
  agruparAreasPorDireccion,
} from './organigrama-utils';

// DOC-033 — organigrama Organización→Dirección→Departamento→Área sobre los mismos datos que la
// tabla plana de DireccionesSection (ningún endpoint nuevo). "Dirección" es `area.dependencia` y
// "Departamento" es `area.departamento`, ambos texto libre, ingresados por el Profesional de AFT
// vía las columnas DIRECCION/DEPARTAMENTO del Excel de carga masiva — mismo criterio y misma
// etiqueta de "sin …" que ya usa la hoja de etiquetas (DOC-029 RF-F, ver lib/etiquetas.ts), para
// no inventar una segunda convención para el mismo concepto. Tarjetas en vez de un diagrama de
// cajas-y-líneas a propósito: con datos reales (decenas de áreas, nombres largos) un layout de
// líneas conectoras se rompe o necesita una librería nueva; una tarjeta por dirección escala mejor
// (wrap/scroll) y sigue el mismo lenguaje visual que el resto del portal (Card + acento de color).
export function JerarquiaSection({
  organizacionNombre,
  areas,
}: {
  organizacionNombre: string;
  areas: Area[] | null;
}) {
  const porDireccion = useMemo(() => {
    return agruparAreasPorDireccion(areas).map(
      ([direccion, areasDeDireccion]) => {
        // Solo vale la pena sub-agrupar por Departamento si alguna área de esta Dirección
        // realmente tiene uno cargado — si nadie usa el campo todavía, se ve como antes: lista
        // plana de áreas, sin un "Sin departamento" repetido en cada tarjeta.
        const usaDepartamento = areasDeDireccion.some((a) =>
          a.departamento?.trim(),
        );
        if (!usaDepartamento) {
          return { direccion, areasDeDireccion, porDepartamento: null };
        }
        const grupos = new Map<string, Area[]>();
        for (const area of areasDeDireccion) {
          const departamento = area.departamento?.trim() || SIN_DEPARTAMENTO;
          const lista = grupos.get(departamento) ?? [];
          lista.push(area);
          grupos.set(departamento, lista);
        }
        const porDepartamento = Array.from(grupos.entries()).sort(([a], [b]) =>
          a === SIN_DEPARTAMENTO
            ? 1
            : b === SIN_DEPARTAMENTO
              ? -1
              : a.localeCompare(b, 'es'),
        );
        return { direccion, areasDeDireccion, porDepartamento };
      },
    );
  }, [areas]);

  if (!areas || areas.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2 text-xs font-bold tracking-wider text-accent-strong uppercase">
        <span>Organigrama</span>
      </div>
      <div className="workspace-card rounded-xl border border-border bg-bg-card p-6 shadow-elev-1">
        <p className="text-xl font-bold tracking-tight text-text">
          {organizacionNombre || 'Organización'}
        </p>
        <p className="mt-0.5 text-xs text-text-dim">
          {porDireccion.length}{' '}
          {porDireccion.length === 1 ? 'dirección' : 'direcciones'} ·{' '}
          {areas.length} {areas.length === 1 ? 'área' : 'áreas'} — definidas por
          el Profesional de AFT (carga desde Excel a la BPI).
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {porDireccion.map(
            ({ direccion, areasDeDireccion, porDepartamento }, i) => {
              const esSinDireccion = direccion === SIN_DIRECCION;
              const acento = ACENTO_DIRECCION[i % ACENTO_DIRECCION.length];
              return (
                <div
                  key={direccion}
                  className={`rounded-lg border border-border bg-bg-raised p-4 ${
                    esSinDireccion
                      ? 'border-dashed opacity-80'
                      : `border-l-4 ${acento.borde}`
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-semibold ${esSinDireccion ? 'text-text-dim' : 'text-text'}`}
                    >
                      {direccion}
                    </p>
                    <span className="shrink-0 rounded-full bg-bg-card px-2 py-0.5 text-[0.7rem] font-medium text-text-faint">
                      {areasDeDireccion.length}
                    </span>
                  </div>
                  {porDepartamento ? (
                    <div className="mt-3 space-y-3">
                      {porDepartamento.map(
                        ([departamento, areasDelDepartamento]) => (
                          <div key={departamento}>
                            <p className="text-[0.7rem] font-semibold tracking-wide text-text-faint uppercase">
                              {departamento}
                            </p>
                            <ul className="mt-1.5 space-y-1.5">
                              {areasDelDepartamento.map((area) => (
                                <li
                                  key={area.id}
                                  className="flex items-center gap-2 text-xs text-text-dim"
                                >
                                  {!esSinDireccion && (
                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${acento.punto}`}
                                    />
                                  )}
                                  <span className="truncate">
                                    {area.nombre}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-1.5">
                      {areasDeDireccion.map((area) => (
                        <li
                          key={area.id}
                          className="flex items-center gap-2 text-xs text-text-dim"
                        >
                          {!esSinDireccion && (
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${acento.punto}`}
                            />
                          )}
                          <span className="truncate">{area.nombre}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}

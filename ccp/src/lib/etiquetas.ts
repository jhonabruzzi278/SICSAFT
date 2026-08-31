// DOC-029 RF-F — agrupación de activos para la hoja de etiquetas: por **dirección** y, dentro de
// cada dirección, por **área**. La "dirección" es `area.dependencia` (RF-B refleja la columna
// DIRECCION del Excel ahí al resolver-o-crear el área). Los activos sin área o sin dirección caen
// en grupos "Sin …" para que ninguna etiqueta se pierda.
import type { ActivoCatalogo, Area } from './cis-client';

export const SIN_DIRECCION = 'Sin dirección';
export const SIN_AREA = 'Sin área asignada';

export interface EtiquetaActivo {
  id: string;
  codigoQr: string;
  nombre: string;
  areaNombre: string;
}

export interface GrupoArea {
  areaNombre: string;
  activos: EtiquetaActivo[];
}

export interface GrupoDireccion {
  direccion: string;
  total: number;
  areas: GrupoArea[];
}

function comparar(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

export function agruparParaEtiquetas(
  activos: readonly ActivoCatalogo[],
  areas: readonly Area[],
): GrupoDireccion[] {
  const areaPorId = new Map(areas.map((a) => [a.id, a]));

  // dirección -> (áreaNombre -> activos)
  const porDireccion = new Map<string, Map<string, EtiquetaActivo[]>>();

  for (const activo of activos) {
    const area = activo.areaId ? areaPorId.get(activo.areaId) : undefined;
    const direccion = area?.dependencia?.trim() || SIN_DIRECCION;
    const areaNombre = area?.nombre?.trim() || SIN_AREA;

    let porArea = porDireccion.get(direccion);
    if (!porArea) {
      porArea = new Map();
      porDireccion.set(direccion, porArea);
    }
    let lista = porArea.get(areaNombre);
    if (!lista) {
      lista = [];
      porArea.set(areaNombre, lista);
    }
    lista.push({
      id: activo.id,
      codigoQr: activo.codigoQr,
      nombre: activo.nombre,
      areaNombre,
    });
  }

  return [...porDireccion.entries()]
    .sort(([a], [b]) => comparar(a, b))
    .map(([direccion, porArea]) => {
      const grupos = [...porArea.entries()]
        .sort(([a], [b]) => comparar(a, b))
        .map(([areaNombre, activosArea]) => ({
          areaNombre,
          activos: [...activosArea].sort((x, y) =>
            comparar(x.codigoQr, y.codigoQr),
          ),
        }));
      const total = grupos.reduce((n, g) => n + g.activos.length, 0);
      return { direccion, total, areas: grupos };
    });
}

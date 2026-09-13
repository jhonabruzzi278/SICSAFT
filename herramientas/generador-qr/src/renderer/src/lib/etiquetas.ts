// DOC-029 RF-F — agrupación de filas para la hoja de etiquetas: por **dirección**, dentro de cada
// dirección por **departamento**, y dentro de cada departamento por **área**. Mismas interfaces y
// mismo algoritmo que ccp/src/lib/etiquetas.ts (portado, no reimplementado) — la única diferencia
// real es la fuente: acá la fila ya viene con `direccionNombre`/`departamentoNombre`/`areaNombre`
// resueltos como texto plano por el ETL (`etl_contable.py --salida -`), así que no hace falta el
// join contra un array de `Area` por `areaId` que sí necesita CCP (que parte de `ActivoCatalogo`
// crudo de CIS).
import type { FilaEtl } from "@shared/ipc-contract";

export const SIN_DIRECCION = "Sin dirección";
export const SIN_DEPARTAMENTO = "Sin departamento";
export const SIN_AREA = "Sin área asignada";

export interface EtiquetaActivo {
  linea: number;
  codigoQr: string;
  nombre: string;
  areaNombre: string;
  codigoAft?: string;
}

export interface GrupoArea {
  areaNombre: string;
  activos: EtiquetaActivo[];
}

export interface GrupoDepartamento {
  departamento: string;
  total: number;
  areas: GrupoArea[];
}

export interface GrupoDireccion {
  direccion: string;
  total: number;
  departamentos: GrupoDepartamento[];
}

function comparar(a: string, b: string): number {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

export function agruparParaEtiquetas(
  filas: readonly FilaEtl[],
): GrupoDireccion[] {
  // dirección -> departamento -> (áreaNombre -> activos)
  const porDireccion = new Map<
    string,
    Map<string, Map<string, EtiquetaActivo[]>>
  >();

  for (const fila of filas) {
    const direccion = fila.direccionNombre?.trim() || SIN_DIRECCION;
    const departamento = fila.departamentoNombre?.trim() || SIN_DEPARTAMENTO;
    const areaNombre = fila.areaNombre?.trim() || SIN_AREA;

    let porDepartamento = porDireccion.get(direccion);
    if (!porDepartamento) {
      porDepartamento = new Map();
      porDireccion.set(direccion, porDepartamento);
    }
    let porArea = porDepartamento.get(departamento);
    if (!porArea) {
      porArea = new Map();
      porDepartamento.set(departamento, porArea);
    }
    let lista = porArea.get(areaNombre);
    if (!lista) {
      lista = [];
      porArea.set(areaNombre, lista);
    }
    lista.push({
      linea: fila.linea,
      codigoQr: fila.codigoQr,
      nombre: fila.nombreAft?.trim() || fila.codigoQr,
      areaNombre,
      codigoAft: fila.codigoPatrimonial,
    });
  }

  return [...porDireccion.entries()]
    .sort(([a], [b]) => comparar(a, b))
    .map(([direccion, porDepartamento]) => {
      const departamentos = [...porDepartamento.entries()]
        .sort(([a], [b]) => comparar(a, b))
        .map(([departamento, porArea]) => {
          const grupos = [...porArea.entries()]
            .sort(([a], [b]) => comparar(a, b))
            .map(([areaNombre, activosArea]) => ({
              areaNombre,
              activos: [...activosArea].sort((x, y) =>
                comparar(x.codigoQr, y.codigoQr),
              ),
            }));
          const total = grupos.reduce((n, g) => n + g.activos.length, 0);
          return { departamento, total, areas: grupos };
        });
      const total = departamentos.reduce((n, d) => n + d.total, 0);
      return { direccion, total, departamentos };
    });
}

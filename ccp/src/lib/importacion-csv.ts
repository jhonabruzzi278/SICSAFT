// DOC-012 6 — parser mínimo del CSV de carga manual de activos. El formato es controlado
// (encabezados fijos, sin comillas ni escapes), así que no se trae una dependencia de CSV
// genérico. La UI vive en src/pages/importaciones/CargaManualCsv.tsx.
import type { FilaImportacionContable } from './cis-client';

export const COLUMNAS_REQUERIDAS = [
  'codigoPatrimonial',
  'codigoQr',
  'catalogoId',
] as const;

export const COLUMNAS_OPCIONALES = [
  'serie',
  'responsableId',
  'areaId',
  'ubicacionId',
  'valorPatrimonial',
] as const;

export function parsearCsv(texto: string): FilaImportacionContable[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lineas.length < 2) {
    throw new Error(
      'El archivo necesita una fila de encabezados y al menos una fila de datos.',
    );
  }
  const encabezados = lineas[0].split(',').map((h) => h.trim());
  for (const columna of COLUMNAS_REQUERIDAS) {
    if (!encabezados.includes(columna)) {
      throw new Error(
        `Falta la columna requerida '${columna}' en el encabezado.`,
      );
    }
  }

  return lineas.slice(1).map((linea, indice) => {
    const valores = linea.split(',').map((v) => v.trim());
    const fila: Record<string, string> = {};
    encabezados.forEach((encabezado, i) => {
      fila[encabezado] = valores[i] ?? '';
    });
    for (const columna of COLUMNAS_REQUERIDAS) {
      if (!fila[columna]) {
        throw new Error(`Fila ${indice + 2}: falta '${columna}'.`);
      }
    }
    const resultado: FilaImportacionContable = {
      codigoPatrimonial: fila.codigoPatrimonial,
      codigoQr: fila.codigoQr,
      catalogoId: fila.catalogoId,
    };
    for (const columna of COLUMNAS_OPCIONALES) {
      const valor = fila[columna];
      if (!valor) continue;
      if (columna === 'valorPatrimonial') {
        resultado.valorPatrimonial = Number(valor);
      } else {
        resultado[columna] = valor;
      }
    }
    return resultado;
  });
}

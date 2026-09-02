import { describe, expect, it } from 'vitest';
import { parsearCsv } from './importacion-csv';

const ENCABEZADO = 'codigoPatrimonial,codigoQr,catalogoId';

describe('parsearCsv', () => {
  it('parsea las columnas requeridas de cada fila', () => {
    const filas = parsearCsv(
      `${ENCABEZADO}\nDG-001,DG-001,cat-1\nDG-002,DG-002,cat-1`,
    );
    expect(filas).toEqual([
      { codigoPatrimonial: 'DG-001', codigoQr: 'DG-001', catalogoId: 'cat-1' },
      { codigoPatrimonial: 'DG-002', codigoQr: 'DG-002', catalogoId: 'cat-1' },
    ]);
  });

  it('incluye las columnas opcionales presentes y convierte valorPatrimonial a número', () => {
    const filas = parsearCsv(
      `${ENCABEZADO},serie,valorPatrimonial\nDG-001,DG-001,cat-1,SN9,850000`,
    );
    expect(filas[0]).toEqual({
      codigoPatrimonial: 'DG-001',
      codigoQr: 'DG-001',
      catalogoId: 'cat-1',
      serie: 'SN9',
      valorPatrimonial: 850000,
    });
  });

  it('ignora columnas opcionales vacías', () => {
    const filas = parsearCsv(`${ENCABEZADO},serie\nDG-001,DG-001,cat-1,`);
    expect(filas[0]).not.toHaveProperty('serie');
  });

  it('tolera CRLF y líneas en blanco', () => {
    const filas = parsearCsv(`${ENCABEZADO}\r\nDG-001,DG-001,cat-1\r\n\r\n`);
    expect(filas).toHaveLength(1);
  });

  it('exige encabezado + al menos una fila de datos', () => {
    expect(() => parsearCsv(ENCABEZADO)).toThrow(
      /encabezados y al menos una fila/,
    );
  });

  it('rechaza un encabezado sin una columna requerida', () => {
    expect(() =>
      parsearCsv('codigoPatrimonial,codigoQr\nDG-001,DG-001'),
    ).toThrow(/catalogoId/);
  });

  it('rechaza una fila a la que le falta un valor requerido, citando el número de fila', () => {
    expect(() => parsearCsv(`${ENCABEZADO}\nDG-001,,cat-1`)).toThrow(/Fila 2/);
  });
});

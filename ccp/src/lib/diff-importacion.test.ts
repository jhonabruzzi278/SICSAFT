import { describe, expect, it } from 'vitest';
import {
  calcularDiffImportacion,
  generarPlantillaCsvEjemplo,
  parsearPlanillaFlexible,
} from './diff-importacion';
import type { ActivoCatalogo } from './cis-client';

describe('parsearPlanillaFlexible', () => {
  it('parsea CSV estándar con comas', () => {
    const csv = [
      'codigoPatrimonial,codigoQr,catalogoId,valorPatrimonial',
      'ACT-1,QR-1,cat-1,150000',
      'ACT-2,QR-2,cat-2,250000',
    ].join('\n');

    const filas = parsearPlanillaFlexible(csv);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toEqual({
      codigoPatrimonial: 'ACT-1',
      codigoQr: 'QR-1',
      catalogoId: 'cat-1',
      valorPatrimonial: 150000,
    });
  });

  it('soporta punto y coma y nombres de cabecera en español / mayúsculas', () => {
    const csv = [
      'CODIGO_PATRIMONIAL;QR;CATALOGO;VALOR',
      'ACT-10;QR-10;cat-notebook;500.000',
    ].join('\n');

    const filas = parsearPlanillaFlexible(csv);
    expect(filas).toHaveLength(1);
    expect(filas[0].codigoPatrimonial).toBe('ACT-10');
    expect(filas[0].codigoQr).toBe('QR-10');
    expect(filas[0].catalogoId).toBe('cat-notebook');
    expect(filas[0].valorPatrimonial).toBe(500000);
  });

  it('arroja error si faltan columnas requeridas o si el archivo está vacío', () => {
    expect(() => parsearPlanillaFlexible('')).toThrow();
    expect(() =>
      parsearPlanillaFlexible('codigoPatrimonial,otro\n1,2'),
    ).toThrow(/Falta la columna obligatoria/);
  });
});

describe('calcularDiffImportacion', () => {
  const catalogo: ActivoCatalogo[] = [
    {
      id: 'ACT-EXISTENTE-1',
      codigoQr: 'QR-EX-1',
      nombre: 'Notebook Dell',
      organizacionId: 'org-1',
      areaId: 'area-1',
      ubicacionId: 'ubi-1',
      estado: 'activo',
    },
    {
      id: 'ACT-EXISTENTE-2',
      codigoQr: 'QR-EX-2',
      nombre: 'Monitor LG',
      organizacionId: 'org-1',
      areaId: 'area-1',
      ubicacionId: 'ubi-1',
      estado: 'activo',
    },
  ];

  it('clasifica altas nuevas, actualizaciones, identicos y conflictos', () => {
    const filas = [
      // Nueva
      {
        codigoPatrimonial: 'ACT-NUEVO-1',
        codigoQr: 'QR-NUEVO-1',
        catalogoId: 'cat-1',
      },
      // Idéntico
      {
        codigoPatrimonial: 'ACT-EXISTENTE-1',
        codigoQr: 'QR-EX-1',
        catalogoId: 'cat-1',
        areaId: 'area-1',
        ubicacionId: 'ubi-1',
      },
      // Actualización (cambia área)
      {
        codigoPatrimonial: 'ACT-EXISTENTE-2',
        codigoQr: 'QR-EX-2',
        catalogoId: 'cat-1',
        areaId: 'area-2',
      },
      // Conflicto: colisión de QR con activo existente distinto
      {
        codigoPatrimonial: 'ACT-OTRO',
        codigoQr: 'QR-EX-1',
        catalogoId: 'cat-1',
      },
    ];

    const { items, resumen } = calcularDiffImportacion(filas, catalogo);

    expect(resumen.total).toBe(4);
    expect(resumen.nuevos).toBe(1);
    expect(resumen.identicos).toBe(1);
    expect(resumen.actualizaciones).toBe(1);
    expect(resumen.conflictos).toBe(1);

    expect(items[0].tipo).toBe('nuevo');
    expect(items[1].tipo).toBe('identico');
    expect(items[2].tipo).toBe('actualizacion');
    expect(items[3].tipo).toBe('conflicto');
  });

  it('detecta duplicados dentro del mismo archivo como conflictos', () => {
    const filas = [
      { codigoPatrimonial: 'A-1', codigoQr: 'Q-1', catalogoId: 'c-1' },
      { codigoPatrimonial: 'A-1', codigoQr: 'Q-2', catalogoId: 'c-1' },
    ];
    const { resumen } = calcularDiffImportacion(filas, []);
    expect(resumen.conflictos).toBe(1);
  });
});

describe('generarPlantillaCsvEjemplo', () => {
  it('produce un CSV no vacío con cabeceras correctas', () => {
    const plantilla = generarPlantillaCsvEjemplo();
    expect(plantilla).toContain('codigoPatrimonial,codigoQr,catalogoId');
  });
});

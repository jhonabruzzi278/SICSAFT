import { describe, expect, it } from 'vitest';
import { agruparParaEtiquetas, SIN_AREA, SIN_DIRECCION } from './etiquetas';
import type { ActivoCatalogo, Area } from './cis-client';

function activo(over: Partial<ActivoCatalogo>): ActivoCatalogo {
  return {
    id: 'a1',
    codigoQr: 'DG-001',
    nombre: 'Notebook',
    organizacionId: 'org',
    areaId: 'area-1',
    ubicacionId: 'ubi-1',
    estado: 'activo',
    ...over,
  };
}

function area(over: Partial<Area>): Area {
  return {
    id: 'area-1',
    organizacionId: 'org',
    codigo: 'A1',
    nombre: 'Contabilidad',
    dependencia: 'Dirección de Administración',
    centroCosto: null,
    responsableId: null,
    ubicacionPrincipalId: null,
    ...over,
  };
}

describe('agruparParaEtiquetas', () => {
  it('agrupa por dirección (area.dependencia) y luego por área', () => {
    const areas = [
      area({
        id: 'area-1',
        nombre: 'Contabilidad',
        dependencia: 'Administración',
      }),
      area({
        id: 'area-2',
        nombre: 'Tesorería',
        dependencia: 'Administración',
      }),
      area({ id: 'area-3', nombre: 'Obras', dependencia: 'Infraestructura' }),
    ];
    const activos = [
      activo({ id: 'a1', codigoQr: 'AD-002', areaId: 'area-1' }),
      activo({ id: 'a2', codigoQr: 'AD-001', areaId: 'area-1' }),
      activo({ id: 'a3', codigoQr: 'TE-001', areaId: 'area-2' }),
      activo({ id: 'a4', codigoQr: 'IN-001', areaId: 'area-3' }),
    ];

    const grupos = agruparParaEtiquetas(activos, areas);

    expect(grupos.map((g) => g.direccion)).toEqual([
      'Administración',
      'Infraestructura',
    ]);
    const admin = grupos[0];
    expect(admin.total).toBe(3);
    expect(admin.areas.map((a) => a.areaNombre)).toEqual([
      'Contabilidad',
      'Tesorería',
    ]);
    // Dentro del área, ordenado por codigoQr (numeric-aware).
    expect(admin.areas[0].activos.map((a) => a.codigoQr)).toEqual([
      'AD-001',
      'AD-002',
    ]);
  });

  it('manda los activos sin área o con área sin dependencia a los grupos "Sin …"', () => {
    const areas = [area({ id: 'area-x', nombre: 'Bodega', dependencia: null })];
    const activos = [
      activo({ id: 'a1', areaId: '', codigoQr: 'X-1' }),
      activo({ id: 'a2', areaId: 'area-x', codigoQr: 'X-2' }),
      activo({ id: 'a3', areaId: 'area-inexistente', codigoQr: 'X-3' }),
    ];

    const grupos = agruparParaEtiquetas(activos, areas);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].direccion).toBe(SIN_DIRECCION);
    expect(grupos[0].total).toBe(3);
    const nombresArea = grupos[0].areas.map((a) => a.areaNombre);
    expect(nombresArea).toContain('Bodega');
    expect(nombresArea).toContain(SIN_AREA);
  });

  it('devuelve lista vacía sin activos', () => {
    expect(agruparParaEtiquetas([], [])).toEqual([]);
  });
});

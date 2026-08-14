import { clasificarEscaneo } from './clasificar-escaneo';
import type { ClasificarEscaneoInput } from './clasificar-escaneo';
import type { Activo } from '../patrimonial/activo.types';

const ACTIVO_BASE: Activo = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-2026-000001',
  codigoQr: 'QR-000001',
  organizacionId: 'duoc-uc',
  areaId: 'area-biblioteca',
  ubicacionId: 'ubicacion-biblioteca-101',
  estado: 'activo',
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: 'Notebook',
    marca: 'Dell',
    modelo: 'Latitude 5440',
  },
};

function buildInput(
  overrides: Partial<ClasificarEscaneoInput> = {},
): ClasificarEscaneoInput {
  return {
    codigoQr: 'QR-000001',
    activo: ACTIVO_BASE,
    duplicado: false,
    yaClasificados: new Set(),
    sesionAreaId: 'area-biblioteca',
    sesionUbicacionId: 'ubicacion-biblioteca-101',
    tieneIncidencia: false,
    ...overrides,
  };
}

describe('clasificarEscaneo', () => {
  it('invalido — formato no reconocido', () => {
    expect(
      clasificarEscaneo(buildInput({ codigoQr: 'código con espacios!' })),
    ).toBe('invalido');
  });

  it('ya_escaneado — codigo ya clasificado en esta sesion (gana sobre duplicado)', () => {
    expect(
      clasificarEscaneo(
        buildInput({
          yaClasificados: new Set(['QR-000001']),
          duplicado: true,
        }),
      ),
    ).toBe('ya_escaneado');
  });

  it('duplicado — mas de un activo activo con el mismo codigoQr', () => {
    expect(clasificarEscaneo(buildInput({ duplicado: true }))).toBe(
      'duplicado',
    );
  });

  it('no_registrado — activo null (no existe o es de otra organizacion)', () => {
    expect(clasificarEscaneo(buildInput({ activo: null }))).toBe(
      'no_registrado',
    );
  });

  it('otra_area — el activo existe pero en otra area', () => {
    expect(
      clasificarEscaneo(buildInput({ sesionAreaId: 'area-informatica' })),
    ).toBe('otra_area');
  });

  it('otra_ubicacion — misma area, otra ubicacion', () => {
    expect(
      clasificarEscaneo(
        buildInput({ sesionUbicacionId: 'ubicacion-otra-oficina' }),
      ),
    ).toBe('otra_ubicacion');
  });

  it('con_incidencia — ubicacion correcta pero con incidencia reportada', () => {
    expect(clasificarEscaneo(buildInput({ tieneIncidencia: true }))).toBe(
      'con_incidencia',
    );
  });

  it('correcto — activo en su area/ubicacion, sin incidencia', () => {
    expect(clasificarEscaneo(buildInput())).toBe('correcto');
  });

  it('acepta codigos con variante BASE-VARIANTE como formato valido', () => {
    expect(
      clasificarEscaneo(buildInput({ codigoQr: 'QR000001-A', activo: null })),
    ).toBe('no_registrado');
  });
});

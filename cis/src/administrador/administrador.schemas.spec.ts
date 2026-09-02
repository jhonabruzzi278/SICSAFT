import {
  actualizarAreaSchema,
  actualizarCondicionesContratoSchema,
  actualizarUbicacionSchema,
  crearLoteImportacionContableSchema,
} from './administrador.schemas';

const ENVOLTORIO = { organizacionId: 'duoc-uc' };

// RF-05 (cierra el gap "ABM completo") — el refine de "al menos un campo a actualizar" solo se
// ejecuta cuando el body pasa por el pipeline HTTP real (ZodValidationPipe), invisible en los
// specs de controller/service que llaman al metodo directo.
describe('actualizarAreaSchema', () => {
  it('acepta el envoltorio con al menos un campo editable', () => {
    expect(
      actualizarAreaSchema.safeParse({
        ...ENVOLTORIO,
        nombre: 'Biblioteca Central',
      }).success,
    ).toBe(true);
  });

  it('acepta cualquiera de los campos editables individualmente', () => {
    expect(
      actualizarAreaSchema.safeParse({ ...ENVOLTORIO, codigo: 'BIB-2' })
        .success,
    ).toBe(true);
    expect(
      actualizarAreaSchema.safeParse({ ...ENVOLTORIO, dependencia: 'Rectoria' })
        .success,
    ).toBe(true);
    expect(
      actualizarAreaSchema.safeParse({ ...ENVOLTORIO, centroCosto: 'CC-100' })
        .success,
    ).toBe(true);
    expect(
      actualizarAreaSchema.safeParse({
        ...ENVOLTORIO,
        responsableId: 'responsable-1',
      }).success,
    ).toBe(true);
    expect(
      actualizarAreaSchema.safeParse({
        ...ENVOLTORIO,
        ubicacionPrincipalId: 'ubicacion-1',
      }).success,
    ).toBe(true);
  });

  it('rechaza el envoltorio sin ningun campo editable', () => {
    expect(actualizarAreaSchema.safeParse(ENVOLTORIO).success).toBe(false);
  });
});

describe('actualizarUbicacionSchema', () => {
  it('acepta el envoltorio con al menos un campo editable', () => {
    expect(
      actualizarUbicacionSchema.safeParse({
        ...ENVOLTORIO,
        edificio: 'Torre A',
      }).success,
    ).toBe(true);
  });

  it('acepta cualquiera de los campos editables individualmente', () => {
    expect(
      actualizarUbicacionSchema.safeParse({ ...ENVOLTORIO, piso: '2' }).success,
    ).toBe(true);
    expect(
      actualizarUbicacionSchema.safeParse({ ...ENVOLTORIO, areaId: 'area-1' })
        .success,
    ).toBe(true);
    expect(
      actualizarUbicacionSchema.safeParse({ ...ENVOLTORIO, oficina: '201' })
        .success,
    ).toBe(true);
    expect(
      actualizarUbicacionSchema.safeParse({
        ...ENVOLTORIO,
        dependencia: 'Biblioteca',
      }).success,
    ).toBe(true);
  });

  it('rechaza el envoltorio sin ningun campo editable', () => {
    expect(actualizarUbicacionSchema.safeParse(ENVOLTORIO).success).toBe(false);
  });
});

// DOC-024 2 — mismo criterio que actualizarAreaSchema/actualizarUbicacionSchema.
describe('actualizarCondicionesContratoSchema', () => {
  it('acepta el envoltorio con al menos un campo editable', () => {
    expect(
      actualizarCondicionesContratoSchema.safeParse({
        ...ENVOLTORIO,
        vigenciaHasta: '2027-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('acepta cualquiera de los campos editables individualmente', () => {
    expect(
      actualizarCondicionesContratoSchema.safeParse({
        ...ENVOLTORIO,
        sedeIds: ['melipilla'],
      }).success,
    ).toBe(true);
    expect(
      actualizarCondicionesContratoSchema.safeParse({
        ...ENVOLTORIO,
        modulosContratados: ['inventario-qr'],
      }).success,
    ).toBe(true);
  });

  it('rechaza el envoltorio sin ningun campo editable', () => {
    expect(
      actualizarCondicionesContratoSchema.safeParse(ENVOLTORIO).success,
    ).toBe(false);
  });
});

// DOC-029 RF-B — el refine "cada fila necesita catalogoId o categoriaNombre" solo se ejecuta al
// parsear el body (ZodValidationPipe), invisible en los specs de controller/service.
describe('crearLoteImportacionContableSchema', () => {
  const base = { organizacionId: 'duoc-uc', origen: 'carpeta' as const };
  const fila = { linea: 1, codigoPatrimonial: 'DG-001', codigoQr: 'DG-001' };

  it('acepta una fila con catalogoId', () => {
    expect(
      crearLoteImportacionContableSchema.safeParse({
        ...base,
        filas: [{ ...fila, catalogoId: 'cat-1' }],
      }).success,
    ).toBe(true);
  });

  it('acepta una fila con categoriaNombre en vez de catalogoId', () => {
    expect(
      crearLoteImportacionContableSchema.safeParse({
        ...base,
        filas: [{ ...fila, categoriaNombre: 'MOBILIARIO' }],
      }).success,
    ).toBe(true);
  });

  it('rechaza una fila sin catalogoId ni categoriaNombre', () => {
    expect(
      crearLoteImportacionContableSchema.safeParse({
        ...base,
        filas: [fila],
      }).success,
    ).toBe(false);
  });
});

import { actualizarAreaSchema, actualizarUbicacionSchema } from './estructura.schemas';

const ENVOLTORIO = {
  correlationId: 'corr-1',
  operadorId: 'op-admin',
  organizacionId: 'duoc-uc',
  rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
};

// RF-05 (cierra el gap "ABM completo") — el refine de "al menos un campo a actualizar" solo se
// ejecuta cuando el body pasa por el pipeline HTTP real (ZodValidationPipe), invisible en los
// specs de controller/service que llaman al metodo directo — igual criterio que el resto del
// proyecto (ver comentarios de "Payload invalido" en administrador.controller.ts de CIS).
describe('actualizarAreaSchema', () => {
  it('acepta el envoltorio con al menos un campo editable', () => {
    expect(
      actualizarAreaSchema.safeParse({ ...ENVOLTORIO, nombre: 'Biblioteca Central' })
        .success,
    ).toBe(true);
  });

  it('acepta cualquiera de los campos editables individualmente', () => {
    expect(actualizarAreaSchema.safeParse({ ...ENVOLTORIO, codigo: 'BIB-2' }).success).toBe(true);
    expect(
      actualizarAreaSchema.safeParse({ ...ENVOLTORIO, dependencia: 'Rectoria' }).success,
    ).toBe(true);
    expect(
      actualizarAreaSchema.safeParse({ ...ENVOLTORIO, centroCosto: 'CC-100' }).success,
    ).toBe(true);
    expect(
      actualizarAreaSchema.safeParse({ ...ENVOLTORIO, responsableId: 'responsable-1' })
        .success,
    ).toBe(true);
    expect(
      actualizarAreaSchema.safeParse({ ...ENVOLTORIO, ubicacionPrincipalId: 'ubicacion-1' })
        .success,
    ).toBe(true);
  });

  it('rechaza el envoltorio sin ningun campo editable', () => {
    const resultado = actualizarAreaSchema.safeParse(ENVOLTORIO);
    expect(resultado.success).toBe(false);
  });
});

describe('actualizarUbicacionSchema', () => {
  it('acepta el envoltorio con al menos un campo editable', () => {
    expect(
      actualizarUbicacionSchema.safeParse({ ...ENVOLTORIO, edificio: 'Torre A' }).success,
    ).toBe(true);
  });

  it('acepta cualquiera de los campos editables individualmente', () => {
    expect(actualizarUbicacionSchema.safeParse({ ...ENVOLTORIO, piso: '2' }).success).toBe(
      true,
    );
    expect(
      actualizarUbicacionSchema.safeParse({ ...ENVOLTORIO, areaId: 'area-1' }).success,
    ).toBe(true);
    expect(
      actualizarUbicacionSchema.safeParse({ ...ENVOLTORIO, oficina: '201' }).success,
    ).toBe(true);
    expect(
      actualizarUbicacionSchema.safeParse({ ...ENVOLTORIO, dependencia: 'Biblioteca' })
        .success,
    ).toBe(true);
  });

  it('rechaza el envoltorio sin ningun campo editable', () => {
    const resultado = actualizarUbicacionSchema.safeParse(ENVOLTORIO);
    expect(resultado.success).toBe(false);
  });
});

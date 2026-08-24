import { actualizarCondicionesContratoSchema } from './contrato.schemas';

const ENVOLTORIO = {
  correlationId: 'corr-1',
  operadorId: 'op-admin',
  organizacionId: 'duoc-uc',
  rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
};

// DOC-024 2 — mismo criterio que estructura.schemas.spec.ts: el refine de "al menos un campo a
// actualizar" solo se ejecuta cuando el body pasa por el pipeline HTTP real (ZodValidationPipe),
// invisible en los specs de controller/service que llaman al metodo directo.
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
        vigenciaHasta: null,
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
    const resultado = actualizarCondicionesContratoSchema.safeParse(ENVOLTORIO);
    expect(resultado.success).toBe(false);
  });
});

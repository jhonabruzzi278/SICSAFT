import {
  aprobarLoteSchema,
  crearLoteSchema,
  rechazarLoteSchema,
} from './importacion-contable-lote.schemas';

const IDENTIDAD = {
  correlationId: 'corr-1',
  operadorId: 'op-1',
  organizacionId: 'muni',
  rolesPorOrganizacion: { muni: ['administrador-patrimonial'] },
};

describe('importacion-contable-lote.schemas', () => {
  describe('crearLoteSchema', () => {
    it('acepta una fila con catalogoId resuelto', () => {
      const r = crearLoteSchema.safeParse({
        ...IDENTIDAD,
        origen: 'carpeta',
        filas: [
          {
            linea: 1,
            codigoPatrimonial: 'DG-001',
            codigoQr: 'DG-001',
            catalogoId: 'cat-1',
          },
        ],
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.filas[0].crudo).toEqual({});
    });

    it('acepta una fila con categoriaNombre en vez de catalogoId', () => {
      const r = crearLoteSchema.safeParse({
        ...IDENTIDAD,
        origen: 'manual',
        filas: [
          {
            linea: 1,
            codigoPatrimonial: 'DG-001',
            codigoQr: 'DG-001',
            categoriaNombre: 'MOBILIARIO',
          },
        ],
      });
      expect(r.success).toBe(true);
    });

    it('rechaza una fila sin catalogoId ni categoriaNombre', () => {
      const r = crearLoteSchema.safeParse({
        ...IDENTIDAD,
        origen: 'carpeta',
        filas: [{ linea: 1, codigoPatrimonial: 'DG-001', codigoQr: 'DG-001' }],
      });
      expect(r.success).toBe(false);
    });

    it('rechaza filas vacías', () => {
      const r = crearLoteSchema.safeParse({
        ...IDENTIDAD,
        origen: 'carpeta',
        filas: [],
      });
      expect(r.success).toBe(false);
    });
  });

  it('aprobarLoteSchema exige la identidad oficial', () => {
    expect(aprobarLoteSchema.safeParse(IDENTIDAD).success).toBe(true);
    expect(aprobarLoteSchema.safeParse({}).success).toBe(false);
  });

  it('rechazarLoteSchema acepta un motivo opcional', () => {
    expect(
      rechazarLoteSchema.safeParse({ ...IDENTIDAD, motivo: 'no cuadra' })
        .success,
    ).toBe(true);
    expect(rechazarLoteSchema.safeParse(IDENTIDAD).success).toBe(true);
  });
});

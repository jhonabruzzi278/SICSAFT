import { buildContextoOperacion } from './contexto-operacion';

describe('buildContextoOperacion', () => {
  it('arma el contexto con operadorId/organizacionId del payload y serviceCaller fijo', () => {
    const contexto = buildContextoOperacion(
      { operadorId: 'op-1', organizacionId: 'duoc-uc' },
      'corr-1',
    );

    expect(contexto).toEqual({
      correlationId: 'corr-1',
      operadorId: 'op-1',
      organizacionId: 'duoc-uc',
      serviceCaller: 'cis',
    });
  });
});

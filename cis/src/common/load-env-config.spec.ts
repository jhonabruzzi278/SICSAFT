import { z } from 'zod';
import { loadEnvConfig } from './load-env-config';

describe('loadEnvConfig', () => {
  const schema = z.object({
    FOO: z.string().min(1, 'es requerido'),
    BAR: z.string().min(1).optional(),
  });

  it('devuelve los datos parseados cuando el env es valido', () => {
    const result = loadEnvConfig(schema, { FOO: 'x' }, 'Prueba');
    expect(result).toEqual({ FOO: 'x' });
  });

  it('lanza con el nombre del label y el campo que falló', () => {
    expect(() => loadEnvConfig(schema, {}, 'Prueba')).toThrow(
      'Configuración de Prueba inválida: FOO:',
    );
  });
});

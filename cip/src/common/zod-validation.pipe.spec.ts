import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({ nombre: z.string().min(1) });
  const pipe = new ZodValidationPipe(schema);

  it('devuelve el valor parseado cuando es valido', () => {
    expect(pipe.transform({ nombre: 'ok' })).toEqual({ nombre: 'ok' });
  });

  it('lanza BadRequestException con el detalle de campos cuando es invalido', () => {
    expect(() => pipe.transform({ nombre: '' })).toThrow(BadRequestException);

    try {
      pipe.transform({ nombre: '' });
      fail('esperaba que transform lanzara');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        errores: unknown[];
      };
      expect(response.errores.length).toBeGreaterThan(0);
    }
  });

  it('propaga errores que no son de Zod', () => {
    const throwingSchema = {
      parse: (): never => {
        throw new Error('boom');
      },
    } as unknown as z.ZodType<unknown>;
    const throwingPipe = new ZodValidationPipe(throwingSchema);

    expect(() => throwingPipe.transform({})).toThrow('boom');
  });
});

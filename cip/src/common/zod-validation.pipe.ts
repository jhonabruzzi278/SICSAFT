import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodType } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Payload inválido',
          errores: error.issues.map((issue) => ({
            campo: issue.path.join('.'),
            detalle: issue.message,
          })),
        });
      }
      throw error;
    }
  }
}

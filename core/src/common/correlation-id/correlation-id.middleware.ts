import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.constants';

export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

// Acepta el correlationId del llamador (CIS lo propaga desde su propio middleware, ver
// cis/src/common/correlation-id/) o genera uno nuevo si CORE es el primer salto — nunca deja una
// request sin correlationId. Se devuelve en la respuesta para que quien llamó pueda confirmar
// cual quedo asociado, aunque no haya mandado uno (WAF 2: "todo evento que cruza un nivel lleva
// el mismo correlationId").
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const recibido = req.header(CORRELATION_ID_HEADER);
    const correlationId =
      recibido && recibido.trim().length > 0 ? recibido : randomUUID();

    (req as RequestWithCorrelationId).correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}

import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.constants';

export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

// CIS es el Nivel 1→2 de la cadena (WAF §2): si el cliente (APP QR/WEB) ya manda un
// correlationId lo respeta, si no genera uno acá — es el primer punto donde el ecosistema puede
// garantizar que existe. CoreClientService lo propaga hacia CORE (ver core-client.service.ts).
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

import type { Request, Response } from 'express';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { CORRELATION_ID_HEADER } from './correlation-id.constants';
import type { RequestWithCorrelationId } from './correlation-id.middleware';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildRequest(headerValue: string | undefined): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === CORRELATION_ID_HEADER ? headerValue : undefined,
  } as unknown as Request;
}

function buildResponse(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as unknown as Response & { headers: Record<string, string> };
}

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  it('reusa el correlationId recibido en el header', () => {
    const req = buildRequest('correlation-existente');
    const res = buildResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect((req as RequestWithCorrelationId).correlationId).toBe(
      'correlation-existente',
    );
    expect(res.headers[CORRELATION_ID_HEADER]).toBe('correlation-existente');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('genera un correlationId nuevo cuando no llega ninguno', () => {
    const req = buildRequest(undefined);
    const res = buildResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    const generado = (req as RequestWithCorrelationId).correlationId;
    expect(generado).toMatch(UUID_V4_REGEX);
    expect(res.headers[CORRELATION_ID_HEADER]).toBe(generado);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('genera un correlationId nuevo cuando el header llega vacío', () => {
    const req = buildRequest('   ');
    const res = buildResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect((req as RequestWithCorrelationId).correlationId).toMatch(
      UUID_V4_REGEX,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});

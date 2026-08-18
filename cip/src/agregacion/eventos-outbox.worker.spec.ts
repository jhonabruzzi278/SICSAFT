/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
const onMock = jest.fn<void, [string, (...args: never[]) => void]>();
const closeMock = jest.fn().mockResolvedValue(undefined);
let capturedProcessor:
  ((job: { id: string; data: unknown }) => unknown) | undefined;
let capturedConnection: unknown;

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((_queueName, processor, opts) => {
    capturedProcessor = processor as typeof capturedProcessor;
    capturedConnection = (opts as { connection: unknown }).connection;
    return { on: onMock, close: closeMock };
  }),
}));

import { AgregacionService } from './agregacion.service';
import { EventosOutboxWorker } from './eventos-outbox.worker';

describe('EventosOutboxWorker', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, REDIS_URL: 'redis://localhost:6379' };
    onMock.mockClear();
    closeMock.mockClear();
    capturedProcessor = undefined;
    capturedConnection = undefined;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('crea el Worker sobre la cola cip-eventos y delega cada job a AgregacionService', async () => {
    const agregacionService = {
      procesarMensaje: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AgregacionService>;
    const worker = new EventosOutboxWorker(agregacionService);

    worker.onModuleInit();

    expect(capturedProcessor).toBeDefined();
    expect(capturedConnection).toBeDefined();

    const mensaje = { kind: 'sesion-cerrada', sesionId: 'ses-1' };
    await capturedProcessor?.({ id: 'job-1', data: mensaje });

    expect(agregacionService.procesarMensaje).toHaveBeenCalledWith(mensaje);
    expect(onMock).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('loguea (sin tirar) cuando el listener failed se dispara', () => {
    const agregacionService = {
      procesarMensaje: jest.fn(),
    } as unknown as jest.Mocked<AgregacionService>;
    const worker = new EventosOutboxWorker(agregacionService);
    worker.onModuleInit();

    const failedHandler = onMock.mock.calls.find(
      ([evento]) => evento === 'failed',
    )?.[1] as (job: { id: string } | undefined, error: Error) => void;

    expect(() =>
      failedHandler({ id: 'job-1' }, new Error('boom')),
    ).not.toThrow();
    expect(() => failedHandler(undefined, new Error('boom'))).not.toThrow();
  });

  it('cierra el worker en onModuleDestroy', async () => {
    const agregacionService = {
      procesarMensaje: jest.fn(),
    } as unknown as jest.Mocked<AgregacionService>;
    const worker = new EventosOutboxWorker(agregacionService);
    worker.onModuleInit();

    await worker.onModuleDestroy();

    expect(closeMock).toHaveBeenCalled();
  });

  it('onModuleDestroy no falla si nunca se inicializó', async () => {
    const agregacionService = {
      procesarMensaje: jest.fn(),
    } as unknown as jest.Mocked<AgregacionService>;
    const worker = new EventosOutboxWorker(agregacionService);

    await expect(worker.onModuleDestroy()).resolves.toBeUndefined();
  });
});

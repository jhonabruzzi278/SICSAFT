/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { PgBoss } from 'pg-boss';
import { AgregacionService } from './agregacion.service';
import { CIP_EVENTOS_QUEUE_NAME } from './eventos-outbox.constants';
import { EventosOutboxWorker } from './eventos-outbox.worker';

type Handler = (jobs: [{ id: string; data: unknown }]) => Promise<void>;

function buildBoss(): jest.Mocked<Pick<PgBoss, 'work' | 'offWork'>> {
  return {
    work: jest.fn().mockResolvedValue('worker-id'),
    offWork: jest.fn().mockResolvedValue(undefined),
  };
}

describe('EventosOutboxWorker', () => {
  it('registra el handler sobre la cola cip-eventos y delega cada job a AgregacionService', async () => {
    const agregacionService = {
      procesarMensaje: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AgregacionService>;
    const boss = buildBoss();
    const worker = new EventosOutboxWorker(
      agregacionService,
      boss as unknown as PgBoss,
    );

    await worker.onModuleInit();

    expect(boss.work).toHaveBeenCalledWith(
      CIP_EVENTOS_QUEUE_NAME,
      expect.any(Function),
    );
    const handler = boss.work.mock.calls[0][1] as Handler;

    const mensaje = { kind: 'sesion-cerrada', sesionId: 'ses-1' };
    await handler([{ id: 'job-1', data: mensaje }]);

    expect(agregacionService.procesarMensaje).toHaveBeenCalledWith(mensaje);
  });

  it('loguea y relanza si procesarMensaje falla, para que pg-boss reintente', async () => {
    const agregacionService = {
      procesarMensaje: jest.fn().mockRejectedValue(new Error('boom')),
    } as unknown as jest.Mocked<AgregacionService>;
    const boss = buildBoss();
    const worker = new EventosOutboxWorker(
      agregacionService,
      boss as unknown as PgBoss,
    );

    await worker.onModuleInit();
    const handler = boss.work.mock.calls[0][1] as Handler;

    await expect(
      handler([{ id: 'job-1', data: { kind: 'evento' } }]),
    ).rejects.toThrow('boom');
  });

  it('desregistra el handler en onModuleDestroy', async () => {
    const agregacionService = {
      procesarMensaje: jest.fn(),
    } as unknown as jest.Mocked<AgregacionService>;
    const boss = buildBoss();
    const worker = new EventosOutboxWorker(
      agregacionService,
      boss as unknown as PgBoss,
    );

    await worker.onModuleDestroy();

    expect(boss.offWork).toHaveBeenCalledWith(CIP_EVENTOS_QUEUE_NAME);
  });
});

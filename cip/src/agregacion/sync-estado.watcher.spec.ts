/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { Queue } from 'bullmq';
import { AgregacionRepository } from './agregacion.repository';
import { SyncEstadoWatcher } from './sync-estado.watcher';

function buildRepository(): jest.Mocked<AgregacionRepository> {
  return {
    obtenerSyncEstado: jest.fn(),
    marcarAtrasado: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AgregacionRepository>;
}

function buildQueue(waitingCount: number): jest.Mocked<Queue> {
  return {
    getWaitingCount: jest.fn().mockResolvedValue(waitingCount),
  } as unknown as jest.Mocked<Queue>;
}

describe('SyncEstadoWatcher', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('no hace nada si la cola está vacía', async () => {
    const repository = buildRepository();
    const queue = buildQueue(0);
    const watcher = new SyncEstadoWatcher(repository, queue);

    await watcher.verificar();

    expect(repository.obtenerSyncEstado).not.toHaveBeenCalled();
    expect(repository.marcarAtrasado).not.toHaveBeenCalled();
  });

  it('marca atrasado si nunca se procesó nada y ya hay pendientes', async () => {
    const repository = buildRepository();
    repository.obtenerSyncEstado.mockResolvedValue({
      ultimoEventoProcesadoEn: null,
      alDia: true,
    });
    const queue = buildQueue(3);
    const watcher = new SyncEstadoWatcher(repository, queue);

    await watcher.verificar();

    expect(repository.marcarAtrasado).toHaveBeenCalled();
  });

  it('no marca atrasado si el último procesado fue hace menos del umbral', async () => {
    const repository = buildRepository();
    repository.obtenerSyncEstado.mockResolvedValue({
      ultimoEventoProcesadoEn: new Date(Date.now() - 60000).toISOString(),
      alDia: true,
    });
    const queue = buildQueue(1);
    const watcher = new SyncEstadoWatcher(repository, queue);

    await watcher.verificar();

    expect(repository.marcarAtrasado).not.toHaveBeenCalled();
  });

  it('marca atrasado si el último procesado supera el umbral configurado', async () => {
    process.env = { ...originalEnv, CIP_UMBRAL_ATRASO_MINUTOS: '5' };
    const repository = buildRepository();
    repository.obtenerSyncEstado.mockResolvedValue({
      ultimoEventoProcesadoEn: new Date(Date.now() - 6 * 60000).toISOString(),
      alDia: true,
    });
    const queue = buildQueue(1);
    const watcher = new SyncEstadoWatcher(repository, queue);

    await watcher.verificar();

    expect(repository.marcarAtrasado).toHaveBeenCalled();
  });

  it('usa el umbral default (15 min) si no hay override en env', async () => {
    process.env = { ...originalEnv };
    delete process.env.CIP_UMBRAL_ATRASO_MINUTOS;
    const repository = buildRepository();
    repository.obtenerSyncEstado.mockResolvedValue({
      ultimoEventoProcesadoEn: new Date(Date.now() - 10 * 60000).toISOString(),
      alDia: true,
    });
    const queue = buildQueue(1);
    const watcher = new SyncEstadoWatcher(repository, queue);

    await watcher.verificar();

    expect(repository.marcarAtrasado).not.toHaveBeenCalled();
  });
});

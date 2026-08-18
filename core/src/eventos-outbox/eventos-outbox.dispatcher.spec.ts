/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { Queue } from 'bullmq';
import { EventosOutboxDispatcher } from './eventos-outbox.dispatcher';
import { EventosOutboxRepository } from './eventos-outbox.repository';
import type { EventoOutboxPendiente } from './eventos-outbox.types';

function buildRepository(
  pendientes: EventoOutboxPendiente[] = [],
): jest.Mocked<EventosOutboxRepository> {
  return {
    findPendientes: jest.fn().mockResolvedValue(pendientes),
    marcarPublicados: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EventosOutboxRepository>;
}

function buildQueue(): jest.Mocked<Queue> {
  return {
    add: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Queue>;
}

describe('EventosOutboxDispatcher', () => {
  it('no publica ni marca nada si no hay pendientes', async () => {
    const repository = buildRepository([]);
    const queue = buildQueue();
    const dispatcher = new EventosOutboxDispatcher(repository, queue);

    await dispatcher.despachar();

    expect(queue.add).not.toHaveBeenCalled();
    expect(repository.marcarPublicados).not.toHaveBeenCalled();
  });

  it('agrupa varios escaneos de la misma sesión en un solo mensaje sesion-cerrada', async () => {
    const repository = buildRepository([
      { id: 'ob-1', eventoId: 'ev-1', tipo: 'escaneo_qr', sesionId: 'ses-1' },
      { id: 'ob-2', eventoId: 'ev-2', tipo: 'escaneo_qr', sesionId: 'ses-1' },
      { id: 'ob-3', eventoId: 'ev-3', tipo: 'escaneo_qr', sesionId: 'ses-1' },
    ]);
    const queue = buildQueue();
    const dispatcher = new EventosOutboxDispatcher(repository, queue);

    await dispatcher.despachar();

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith('sesion-cerrada', {
      kind: 'sesion-cerrada',
      sesionId: 'ses-1',
    });
    expect(repository.marcarPublicados).toHaveBeenCalledWith([
      'ob-1',
      'ob-2',
      'ob-3',
    ]);
  });

  it('publica un mensaje evento por cada pendiente sin sesionId', async () => {
    const repository = buildRepository([
      { id: 'ob-1', eventoId: 'ev-1', tipo: 'alta', sesionId: null },
      { id: 'ob-2', eventoId: 'ev-2', tipo: 'baja', sesionId: null },
    ]);
    const queue = buildQueue();
    const dispatcher = new EventosOutboxDispatcher(repository, queue);

    await dispatcher.despachar();

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith('evento', {
      kind: 'evento',
      eventoId: 'ev-1',
      tipo: 'alta',
    });
    expect(queue.add).toHaveBeenCalledWith('evento', {
      kind: 'evento',
      eventoId: 'ev-2',
      tipo: 'baja',
    });
    expect(repository.marcarPublicados).toHaveBeenCalledWith(['ob-1', 'ob-2']);
  });

  it('mezcla sesiones agrupadas y eventos individuales en el mismo ciclo', async () => {
    const repository = buildRepository([
      { id: 'ob-1', eventoId: 'ev-1', tipo: 'escaneo_qr', sesionId: 'ses-1' },
      { id: 'ob-2', eventoId: 'ev-2', tipo: 'mantenimiento', sesionId: null },
    ]);
    const queue = buildQueue();
    const dispatcher = new EventosOutboxDispatcher(repository, queue);

    await dispatcher.despachar();

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(repository.marcarPublicados).toHaveBeenCalledWith(['ob-1', 'ob-2']);
  });

  it('si la cola falla, solo marca como publicado lo que sí se encoló antes del fallo', async () => {
    const repository = buildRepository([
      { id: 'ob-1', eventoId: 'ev-1', tipo: 'alta', sesionId: null },
      { id: 'ob-2', eventoId: 'ev-2', tipo: 'baja', sesionId: null },
    ]);
    const queue = buildQueue();
    queue.add
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error('Redis caído'));
    const dispatcher = new EventosOutboxDispatcher(repository, queue);

    await dispatcher.despachar();

    expect(repository.marcarPublicados).toHaveBeenCalledWith(['ob-1']);
  });

  it('si falla en el grupo de una sesión, no publica las sesiones siguientes ni los individuales', async () => {
    const repository = buildRepository([
      { id: 'ob-1', eventoId: 'ev-1', tipo: 'escaneo_qr', sesionId: 'ses-1' },
      { id: 'ob-2', eventoId: 'ev-2', tipo: 'escaneo_qr', sesionId: 'ses-2' },
      { id: 'ob-3', eventoId: 'ev-3', tipo: 'alta', sesionId: null },
    ]);
    const queue = buildQueue();
    queue.add
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error('Redis caído'));
    const dispatcher = new EventosOutboxDispatcher(repository, queue);

    await dispatcher.despachar();

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(repository.marcarPublicados).toHaveBeenCalledWith(['ob-1']);
  });

  it('si falla desde el primer mensaje, marca con una lista vacía', async () => {
    const repository = buildRepository([
      { id: 'ob-1', eventoId: 'ev-1', tipo: 'alta', sesionId: null },
    ]);
    const queue = buildQueue();
    queue.add.mockRejectedValueOnce(new Error('Redis caído'));
    const dispatcher = new EventosOutboxDispatcher(repository, queue);

    await dispatcher.despachar();

    expect(repository.marcarPublicados).toHaveBeenCalledWith([]);
  });

  it('propaga un error no-Error de la cola sin romper el ciclo (mensaje por defecto)', async () => {
    const repository = buildRepository([
      { id: 'ob-1', eventoId: 'ev-1', tipo: 'alta', sesionId: null },
    ]);
    const queue = buildQueue();
    queue.add.mockRejectedValueOnce('fallo-string');
    const dispatcher = new EventosOutboxDispatcher(repository, queue);

    await dispatcher.despachar();

    expect(repository.marcarPublicados).toHaveBeenCalledWith([]);
  });
});

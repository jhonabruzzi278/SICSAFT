/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { PgBoss } from 'pg-boss';
import { CIP_EVENTOS_QUEUE_NAME } from './eventos-outbox.constants';
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

function buildBoss(): jest.Mocked<Pick<PgBoss, 'send'>> {
  return {
    send: jest.fn().mockResolvedValue('job-id'),
  };
}

describe('EventosOutboxDispatcher', () => {
  it('no publica ni marca nada si no hay pendientes', async () => {
    const repository = buildRepository([]);
    const boss = buildBoss();
    const dispatcher = new EventosOutboxDispatcher(
      repository,
      boss as unknown as PgBoss,
    );

    await dispatcher.despachar();

    expect(boss.send).not.toHaveBeenCalled();
    expect(repository.marcarPublicados).not.toHaveBeenCalled();
  });

  it('agrupa varios escaneos de la misma sesión en un solo mensaje sesion-cerrada', async () => {
    const repository = buildRepository([
      {
        id: 'ob-1',
        eventoId: 'ev-1',
        tipo: 'escaneo_qr',
        sesionId: 'ses-1',
        organizacionId: 'org-1',
      },
      {
        id: 'ob-2',
        eventoId: 'ev-2',
        tipo: 'escaneo_qr',
        sesionId: 'ses-1',
        organizacionId: 'org-1',
      },
      {
        id: 'ob-3',
        eventoId: 'ev-3',
        tipo: 'escaneo_qr',
        sesionId: 'ses-1',
        organizacionId: 'org-1',
      },
    ]);
    const boss = buildBoss();
    const dispatcher = new EventosOutboxDispatcher(
      repository,
      boss as unknown as PgBoss,
    );

    await dispatcher.despachar();

    expect(boss.send).toHaveBeenCalledTimes(1);
    expect(boss.send).toHaveBeenCalledWith(CIP_EVENTOS_QUEUE_NAME, {
      kind: 'sesion-cerrada',
      sesionId: 'ses-1',
    });
    expect(repository.marcarPublicados).toHaveBeenCalledWith([
      'ob-1',
      'ob-2',
      'ob-3',
    ]);
  });

  it('publica un mensaje evento (con organizacionId) por cada pendiente sin sesionId', async () => {
    const repository = buildRepository([
      {
        id: 'ob-1',
        eventoId: 'ev-1',
        tipo: 'alta',
        sesionId: null,
        organizacionId: 'org-1',
      },
      {
        id: 'ob-2',
        eventoId: 'ev-2',
        tipo: 'baja',
        sesionId: null,
        organizacionId: null,
      },
    ]);
    const boss = buildBoss();
    const dispatcher = new EventosOutboxDispatcher(
      repository,
      boss as unknown as PgBoss,
    );

    await dispatcher.despachar();

    expect(boss.send).toHaveBeenCalledTimes(2);
    expect(boss.send).toHaveBeenCalledWith(CIP_EVENTOS_QUEUE_NAME, {
      kind: 'evento',
      eventoId: 'ev-1',
      tipo: 'alta',
      organizacionId: 'org-1',
    });
    expect(boss.send).toHaveBeenCalledWith(CIP_EVENTOS_QUEUE_NAME, {
      kind: 'evento',
      eventoId: 'ev-2',
      tipo: 'baja',
      organizacionId: null,
    });
    expect(repository.marcarPublicados).toHaveBeenCalledWith(['ob-1', 'ob-2']);
  });

  it('mezcla sesiones agrupadas y eventos individuales en el mismo ciclo', async () => {
    const repository = buildRepository([
      {
        id: 'ob-1',
        eventoId: 'ev-1',
        tipo: 'escaneo_qr',
        sesionId: 'ses-1',
        organizacionId: 'org-1',
      },
      {
        id: 'ob-2',
        eventoId: 'ev-2',
        tipo: 'mantenimiento',
        sesionId: null,
        organizacionId: 'org-1',
      },
    ]);
    const boss = buildBoss();
    const dispatcher = new EventosOutboxDispatcher(
      repository,
      boss as unknown as PgBoss,
    );

    await dispatcher.despachar();

    expect(boss.send).toHaveBeenCalledTimes(2);
    expect(repository.marcarPublicados).toHaveBeenCalledWith(['ob-1', 'ob-2']);
  });

  it('si la cola falla, solo marca como publicado lo que sí se encoló antes del fallo', async () => {
    const repository = buildRepository([
      {
        id: 'ob-1',
        eventoId: 'ev-1',
        tipo: 'alta',
        sesionId: null,
        organizacionId: 'org-1',
      },
      {
        id: 'ob-2',
        eventoId: 'ev-2',
        tipo: 'baja',
        sesionId: null,
        organizacionId: 'org-1',
      },
    ]);
    const boss = buildBoss();
    boss.send
      .mockResolvedValueOnce('job-id')
      .mockRejectedValueOnce(new Error('Postgres caído'));
    const dispatcher = new EventosOutboxDispatcher(
      repository,
      boss as unknown as PgBoss,
    );

    await dispatcher.despachar();

    expect(repository.marcarPublicados).toHaveBeenCalledWith(['ob-1']);
  });

  it('si falla en el grupo de una sesión, no publica las sesiones siguientes ni los individuales', async () => {
    const repository = buildRepository([
      {
        id: 'ob-1',
        eventoId: 'ev-1',
        tipo: 'escaneo_qr',
        sesionId: 'ses-1',
        organizacionId: 'org-1',
      },
      {
        id: 'ob-2',
        eventoId: 'ev-2',
        tipo: 'escaneo_qr',
        sesionId: 'ses-2',
        organizacionId: 'org-1',
      },
      {
        id: 'ob-3',
        eventoId: 'ev-3',
        tipo: 'alta',
        sesionId: null,
        organizacionId: 'org-1',
      },
    ]);
    const boss = buildBoss();
    boss.send
      .mockResolvedValueOnce('job-id')
      .mockRejectedValueOnce(new Error('Postgres caído'));
    const dispatcher = new EventosOutboxDispatcher(
      repository,
      boss as unknown as PgBoss,
    );

    await dispatcher.despachar();

    expect(boss.send).toHaveBeenCalledTimes(2);
    expect(repository.marcarPublicados).toHaveBeenCalledWith(['ob-1']);
  });

  it('si falla desde el primer mensaje, marca con una lista vacía', async () => {
    const repository = buildRepository([
      {
        id: 'ob-1',
        eventoId: 'ev-1',
        tipo: 'alta',
        sesionId: null,
        organizacionId: 'org-1',
      },
    ]);
    const boss = buildBoss();
    boss.send.mockRejectedValueOnce(new Error('Postgres caído'));
    const dispatcher = new EventosOutboxDispatcher(
      repository,
      boss as unknown as PgBoss,
    );

    await dispatcher.despachar();

    expect(repository.marcarPublicados).toHaveBeenCalledWith([]);
  });

  it('propaga un error no-Error de la cola sin romper el ciclo (mensaje por defecto)', async () => {
    const repository = buildRepository([
      {
        id: 'ob-1',
        eventoId: 'ev-1',
        tipo: 'alta',
        sesionId: null,
        organizacionId: 'org-1',
      },
    ]);
    const boss = buildBoss();
    boss.send.mockRejectedValueOnce('fallo-string');
    const dispatcher = new EventosOutboxDispatcher(
      repository,
      boss as unknown as PgBoss,
    );

    await dispatcher.despachar();

    expect(repository.marcarPublicados).toHaveBeenCalledWith([]);
  });
});

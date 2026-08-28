import { loadEventosOutboxQueueConfig } from './eventos-outbox-queue.config';

describe('loadEventosOutboxQueueConfig', () => {
  it('lee EVENTOS_OUTBOX_DATABASE_URL del entorno', () => {
    const config = loadEventosOutboxQueueConfig({
      EVENTOS_OUTBOX_DATABASE_URL:
        'postgres://eventos:secreto@postgres/eventos_outbox',
    });

    expect(config).toEqual({
      connectionString: 'postgres://eventos:secreto@postgres/eventos_outbox',
    });
  });

  it('tira un error legible si falta EVENTOS_OUTBOX_DATABASE_URL', () => {
    expect(() => loadEventosOutboxQueueConfig({})).toThrow(
      /Configuración de la cola de eventos inválida/,
    );
  });
});

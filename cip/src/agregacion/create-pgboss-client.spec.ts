import { createPgBossClient } from './create-pgboss-client';

describe('createPgBossClient', () => {
  it('no crashea el proceso si el cliente emite error (listener registrado)', async () => {
    const boss = await createPgBossClient(
      'postgres://localhost/eventos_outbox',
    );

    expect(() => boss.emit('error', new Error('ECONNREFUSED'))).not.toThrow();
  });
});

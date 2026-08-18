import { createRedisConnection } from './create-redis-connection';

describe('createRedisConnection', () => {
  it('no crashea el proceso si el socket emite error (listener registrado)', () => {
    const client = createRedisConnection('redis://localhost:6379');

    expect(() => client.emit('error', new Error('ECONNREFUSED'))).not.toThrow();

    client.disconnect();
  });
});

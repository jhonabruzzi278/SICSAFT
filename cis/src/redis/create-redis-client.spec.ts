import { createRedisClient } from './create-redis-client';

describe('createRedisClient', () => {
  it('no crashea el proceso si el socket emite error (listener registrado)', () => {
    const client = createRedisClient('redis://localhost:6379');

    expect(() => client.emit('error', new Error('ECONNREFUSED'))).not.toThrow();

    client.disconnect();
  });
});

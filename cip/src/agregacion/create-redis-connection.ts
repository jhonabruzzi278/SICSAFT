import Redis from 'ioredis';

// Mismo criterio que core/src/eventos-outbox/create-redis-connection.ts — `maxRetriesPerRequest:
// null` porque BullMQ (acá, un Worker) lo exige; `lazyConnect` para no acoplar instanciar el
// modulo a que Redis este arriba.
export function createRedisConnection(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  client.on('error', () => undefined);
  return client;
}

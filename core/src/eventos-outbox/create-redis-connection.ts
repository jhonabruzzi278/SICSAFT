import Redis from 'ioredis';

// BullMQ exige `maxRetriesPerRequest: null` en la conexion que le pasamos (lo usa para sus propios
// comandos bloqueantes) — sin esto tira un error al arrancar. `lazyConnect` mismo criterio que
// cis/src/redis/create-redis-client.ts: no conecta hasta el primer comando real, para no acoplar
// instanciar el modulo a que Redis este arriba (relevante en tests).
export function createRedisConnection(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  client.on('error', () => undefined);
  return client;
}

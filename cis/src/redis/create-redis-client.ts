import Redis from 'ioredis';

// `lazyConnect: true` — no intenta conectar al construir el cliente (evita que instanciar el
// modulo, ej. en tests que nunca ejercitan un consumidor de Redis, dependa de que haya un Redis
// real disponible). El primer comando real dispara la conexion.
export function createRedisClient(url: string): Redis {
  const client = new Redis(url, { lazyConnect: true });
  // Sin este listener, un error de conexion (Redis caido) es un 'error' no manejado sobre el
  // EventEmitter y tumba el proceso — los consumidores (RedisRateLimiter, DeviceRegistryService)
  // ya fallan abiertos ante un error de comando, este listener solo evita el crash a nivel de
  // socket.
  client.on('error', () => undefined);
  return client;
}

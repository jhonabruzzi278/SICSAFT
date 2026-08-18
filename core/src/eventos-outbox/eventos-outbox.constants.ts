export const CIP_EVENTOS_QUEUE_NAME = 'cip-eventos';
export const CIP_EVENTOS_QUEUE = Symbol('CIP_EVENTOS_QUEUE');
// BullMQ no cierra una conexion de ioredis que le pasamos nosotros (Queue.close() solo cierra lo
// que el mismo creo) — se registra aparte para poder desconectarla en onModuleDestroy, ver
// eventos-outbox.module.ts.
export const CIP_EVENTOS_REDIS_CONNECTION = Symbol(
  'CIP_EVENTOS_REDIS_CONNECTION',
);

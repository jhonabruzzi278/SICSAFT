export const CIP_EVENTOS_QUEUE_NAME = 'cip-eventos';
// ADR-005 — antes dos tokens (Queue de BullMQ + conexión ioredis separada, para poder cerrar la
// conexión que BullMQ no cerraba solo). pg-boss expone un único cliente que ya encapsula su propia
// conexión — no hace falta separarlos para el cleanup en `onModuleDestroy`.
export const CIP_EVENTOS_PGBOSS = Symbol('CIP_EVENTOS_PGBOSS');

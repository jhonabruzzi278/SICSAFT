// ADR-005 — antes dos tokens (Worker de BullMQ + conexión ioredis separada para
// SyncEstadoWatcher.getWaitingCount(), ver historial). pg-boss expone un único cliente que ya
// encapsula su propia conexión y sirve tanto para `work()` como para `getQueue()` — no hace falta
// separarlos.
export const CIP_EVENTOS_PGBOSS = Symbol('CIP_EVENTOS_PGBOSS');

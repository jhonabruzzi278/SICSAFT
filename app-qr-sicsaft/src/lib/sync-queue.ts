// Cola sin conexión (TASK-008, DOC-002 sección 4). No hay object store nuevo:
// la cola es simplemente `sessions` filtrada por syncStatus === 'pending'. El
// guardado local siempre sucede primero y no depende de la conectividad — DOC-002
// exige que nunca se pierdan los datos ya escaneados aunque falle el envío.
import {
  getAllSessions,
  initInventoryDb,
  saveSession,
  updateSession,
  type ScanSession,
} from './db';
import { qrConnector, RejectedInventarioError, type InventarioPayload } from './qr-connector';
import { logAuditEvent } from './audit-log';
import { getOrCreateDeviceId } from './device-id';

const BACKOFF_SCHEDULE_MS = [5_000, 15_000, 45_000];
const STEADY_STATE_MS = 5 * 60 * 1000;
const TICK_INTERVAL_MS = 2_000;

function nextRetryDelayMs(attemptsSoFar: number): number {
  return BACKOFF_SCHEDULE_MS[attemptsSoFar] ?? STEADY_STATE_MS;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = initInventoryDb();
  return dbPromise;
}

async function attemptSend(db: IDBDatabase, session: ScanSession): Promise<void> {
  const { id: _id, syncStatus: _syncStatus, syncAttempts, lastAttemptAt: _lastAttemptAt, nextRetryAt: _nextRetryAt, ...payload } =
    session;
  try {
    await qrConnector.postInventario(payload as InventarioPayload);
    await updateSession(db, { ...session, syncStatus: 'synced', lastAttemptAt: new Date().toISOString() });
    await logAuditEvent({
      event: 'sync_status_changed',
      correlationId: session.correlationId,
      operatorName: session.operatorName,
      deviceId: getOrCreateDeviceId(),
      syncStatus: 'synced',
      organizationName: session.organizationName,
      areaName: session.areaName,
      locationName: session.locationName,
    });
  } catch (error) {
    // DOC-002 §5: un 400/409 de CORE es un rechazo permanente (payload inválido o
    // idempotencyKey reutilizada con otro payload) — reintentarlo para siempre nunca lo va a
    // hacer pasar, así que corta la cola acá en vez de seguir intentando cada 5 minutos.
    // Cualquier otra falla (5xx, sin red, 401 sin refresh posible) sigue siendo transitoria.
    if (error instanceof RejectedInventarioError) {
      await updateSession(db, {
        ...session,
        syncStatus: 'rejected',
        lastAttemptAt: new Date().toISOString(),
      });
      await logAuditEvent({
        event: 'sync_status_changed',
        correlationId: session.correlationId,
        operatorName: session.operatorName,
        deviceId: getOrCreateDeviceId(),
        syncStatus: 'rejected',
        organizationName: session.organizationName,
        areaName: session.areaName,
        locationName: session.locationName,
      });
      return;
    }

    const attempts = syncAttempts + 1;
    const nextRetryAt = new Date(Date.now() + nextRetryDelayMs(syncAttempts)).toISOString();
    await updateSession(db, {
      ...session,
      syncStatus: 'pending',
      syncAttempts: attempts,
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt,
    });
    await logAuditEvent({
      event: 'sync_status_changed',
      correlationId: session.correlationId,
      operatorName: session.operatorName,
      deviceId: getOrCreateDeviceId(),
      syncStatus: 'pending',
      organizationName: session.organizationName,
      areaName: session.areaName,
      locationName: session.locationName,
    });
  }
}

export async function submitInventario(session: InventarioPayload): Promise<void> {
  const db = await getDb();
  const base: ScanSession = { ...session, syncStatus: 'pending', syncAttempts: 0 };
  const id = await saveSession(db, base);
  await attemptSend(db, { ...base, id });
}

async function retryPending(ignoreBackoff: boolean): Promise<void> {
  const db = await getDb();
  const sessions = await getAllSessions(db);
  const now = Date.now();
  const due = sessions.filter(
    (s) => s.syncStatus === 'pending' && (ignoreBackoff || !s.nextRetryAt || new Date(s.nextRetryAt).getTime() <= now),
  );
  for (const session of due) {
    await attemptSend(db, session);
  }
}

// Respeta el backoff — usado por el ticker periódico.
export function retryPendingSessions(): Promise<void> {
  return retryPending(false);
}

let tickerHandle: ReturnType<typeof setInterval> | null = null;

export function startSyncQueueTicker(): () => void {
  if (tickerHandle) return () => {};

  tickerHandle = setInterval(() => {
    retryPendingSessions();
  }, TICK_INTERVAL_MS);
  // Al recuperar conexión se reintenta de inmediato, sin esperar el backoff —
  // el backoff es para seguir esperando mientras sigue sin haber red, no para
  // demorar el envío una vez que la conexión ya volvió.
  const handleOnline = () => retryPending(true);
  window.addEventListener('online', handleOnline);

  return () => {
    if (tickerHandle) clearInterval(tickerHandle);
    tickerHandle = null;
    window.removeEventListener('online', handleOnline);
  };
}

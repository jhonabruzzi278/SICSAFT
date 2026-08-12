// Punto único de escritura del registro de auditoría (TASK-009, DOC-002
// sección 6) — evita repetir el boilerplate de IndexedDB en cada caller
// (ScanPage.tsx, sync-queue.ts).
import { addAuditEntry, initInventoryDb, type AuditEntry } from './db';

let dbPromise: Promise<IDBDatabase> | null = null;
function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = initInventoryDb();
  return dbPromise;
}

export async function logAuditEvent(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  const db = await getDb();
  await addAuditEntry(db, { ...entry, timestamp: new Date().toISOString() });
}

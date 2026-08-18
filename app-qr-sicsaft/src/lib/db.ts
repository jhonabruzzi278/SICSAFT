// Capa de acceso a datos: IndexedDB almacena el inventario de productos
// registrados (sembrado inicialmente con P001-P015, editable después desde
// la UI) y el historial de sesiones de escaneo.
import { FULL_CATALOG, REGISTERED_CODES } from './catalog-data';
import type { Verdict } from './verdict';

export interface ProductVariant {
  code: string;
  name: string;
  stock: number;
}

export interface Product {
  code: string;
  name: string;
  description?: string;
  category?: string;
  unitType?: 'unitario' | 'peso' | 'volumen';
  hasIva?: boolean;
  ivaPercent?: number;
  priceWithoutTax?: number;
  finalPrice?: number;
  stock?: number;
  minStock?: number;
  variants?: ProductVariant[];
  image?: string;
  createdAt?: string;
  // Ubicación patrimonial esperada — sin esto no se puede distinguir "activo
  // correcto" de "otra área"/"otra ubicación" al escanear (ver scan-resolve.ts).
  organizationId?: string;
  areaId?: string;
  locationId?: string;
}

// Clasificación de un escaneo (DOC-001 sección 3). 'duplicate' se reserva pero
// no es alcanzable client-side: IndexedDB usa `code` como clave única, así que
// dos registros con el mismo código físico no pueden coexistir en el cliente —
// esa categoría la detectará el futuro Base Patrimonial Central (backend).
export type ScanCategory =
  | 'correct'
  | 'wrong-area'
  | 'wrong-location'
  | 'unregistered'
  | 'invalid'
  | 'already-scanned'
  | 'duplicate';

// Fase 3.1/DOC-017 §3, DOC-012 §5.1 — declarable por cualquier operador, sin rol
// administrador-patrimonial (Tomo III §1.4 ya se lo concede a APP QR). 'activo' es el estado por
// defecto (no-op si el activo ya está así); CORE aplica la transición real y la ignora en
// silencio si el activo no está en un estado operativo compatible (ver core InventariosService).
export type EstadoOperativoDeclarable = 'activo' | 'mantenimiento' | 'inactivo';

export interface ScannedSessionItem {
  code: string;
  name: string;
  category: ScanCategory;
  incidentNote?: string;
  outOfPlace?: boolean;
  externalFind?: boolean;
  // Fase 3.1 — ambos opcionales, nunca tocan Base Patrimonial directo (CORE los aplica/registra
  // como informe, no como escritura oficial). `bajaSugerida` es solo el motivo: nunca ejecuta la
  // baja, la revisa el Administrador Patrimonial desde WEB (DOC-012 §5.1).
  estadoDeclarado?: EstadoOperativoDeclarable;
  bajaSugerida?: string;
}

// 'rejected' se reserva pero no es alcanzable todavía: el stub del Conector QR
// (qr-connector.ts) nunca devuelve un 400 real — eso llega recién con
// TASK-007, cuando haya un backend real que pueda rechazar el payload.
export type SyncStatus = 'pending' | 'synced' | 'rejected';

export interface ScanSession {
  id?: number;
  operatorName: string;
  organizationId: string;
  organizationName: string;
  areaId: string;
  areaName: string;
  locationId: string;
  locationName: string;
  startedAt: string;
  date: string;
  total: number;
  correct: number;
  wrongArea: number;
  wrongLocation: number;
  unregistered: number;
  invalid: number;
  incidents: number;
  // Fase 3.1/DOC-017 §2 y §4 — `missing` no se derivaba de nada guardado en la sesión (solo se
  // calculaba al vuelo contra el catálogo en ScanPage); se persiste acá para que
  // calcularVeredicto pueda recalcularse después (ej. HistoryPage) sin necesitar el catálogo
  // completo de nuevo. `verdict` se calcula una sola vez al confirmar el envío — ver lib/verdict.ts.
  missing: number;
  verdict: Verdict;
  items: ScannedSessionItem[];
  syncStatus: SyncStatus;
  // Bookkeeping de la cola sin conexión (TASK-008, DOC-002 sección 4) — la
  // cola de reintentos es simplemente `sessions` filtrada por syncStatus.
  syncAttempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  // Generado al iniciar el inventario, no al enviarlo (DOC-002 sección 6) —
  // viaja en cada operación relacionada y en el registro de auditoría.
  correlationId: string;
}

// Registro de auditoría local (TASK-009, DOC-002 sección 6): operador,
// fecha/hora, dispositivo, inventario (correlationId), código leído,
// resultado, ubicación, incidencia, estado de sincronización.
export type AuditEvent = 'inventory_started' | 'scan' | 'incident_added' | 'inventory_finished' | 'sync_status_changed';

export interface AuditEntry {
  id?: number;
  correlationId: string;
  timestamp: string;
  operatorName: string;
  deviceId: string;
  event: AuditEvent;
  organizationName?: string;
  areaName?: string;
  locationName?: string;
  code?: string;
  category?: ScanCategory;
  incidentNote?: string;
  syncStatus?: SyncStatus;
}

const DB_NAME = 'qrvault-inventory';
const DB_VERSION = 3;
const STORE_PRODUCTS = 'products';
const STORE_SESSIONS = 'sessions';
const STORE_AUDIT = 'auditLog';

function openInventoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: 'code' });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIT)) {
        db.createObjectStore(STORE_AUDIT, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(request.error);
  });
}

async function seedInventoryIfEmpty(db: IDBDatabase): Promise<void> {
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const req = tx.objectStore(STORE_PRODUCTS).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (count > 0) return;

  const registeredProducts = FULL_CATALOG.filter((p) => REGISTERED_CODES.includes(p.code));

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);
    registeredProducts.forEach((p) => store.put(p));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function initInventoryDb(): Promise<IDBDatabase> {
  const db = await openInventoryDb();
  await seedInventoryIfEmpty(db);
  return db;
}

export function lookupProduct(db: IDBDatabase, code: string): Promise<Product | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const req = tx.objectStore(STORE_PRODUCTS).get(code);
    req.onsuccess = () => resolve((req.result as Product) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function productCodeExists(db: IDBDatabase, code: string): Promise<boolean> {
  const existing = await lookupProduct(db, code);
  return existing !== null;
}

export function getAllProducts(db: IDBDatabase): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const req = tx.objectStore(STORE_PRODUCTS).getAll();
    req.onsuccess = () => resolve((req.result as Product[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export function putProduct(db: IDBDatabase, product: Product): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    tx.objectStore(STORE_PRODUCTS).put(product);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function deleteProduct(db: IDBDatabase, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    tx.objectStore(STORE_PRODUCTS).delete(code);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function saveSession(db: IDBDatabase, session: ScanSession): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const req = tx.objectStore(STORE_SESSIONS).add(session);
    req.onsuccess = () => resolve(req.result as number);
    tx.onerror = () => reject(tx.error);
  });
}

export function updateSession(db: IDBDatabase, session: ScanSession): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getAllSessions(db: IDBDatabase): Promise<ScanSession[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const req = tx.objectStore(STORE_SESSIONS).getAll();
    req.onsuccess = () => resolve(((req.result as ScanSession[]) ?? []).reverse());
    req.onerror = () => reject(req.error);
  });
}

export function addAuditEntry(db: IDBDatabase, entry: AuditEntry): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIT, 'readwrite');
    const req = tx.objectStore(STORE_AUDIT).add(entry);
    req.onsuccess = () => resolve(req.result as number);
    tx.onerror = () => reject(tx.error);
  });
}

export function getAuditEntriesByCorrelationId(db: IDBDatabase, correlationId: string): Promise<AuditEntry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIT, 'readonly');
    const req = tx.objectStore(STORE_AUDIT).getAll();
    req.onsuccess = () => {
      const all = (req.result as AuditEntry[]) ?? [];
      resolve(all.filter((entry) => entry.correlationId === correlationId));
    };
    req.onerror = () => reject(req.error);
  });
}

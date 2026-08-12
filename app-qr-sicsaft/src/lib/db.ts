// Capa de acceso a datos: IndexedDB almacena el inventario de productos
// registrados (sembrado inicialmente con P001-P015, editable después desde
// la UI) y el historial de sesiones de escaneo.
import { FULL_CATALOG, REGISTERED_CODES } from './catalog-data';

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

export interface ScannedSessionItem {
  code: string;
  name: string;
  category: ScanCategory;
  incidentNote?: string;
  outOfPlace?: boolean;
  externalFind?: boolean;
}

export type SyncStatus = 'local'; // único valor posible hasta TASK-008 (cola offline)

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
  items: ScannedSessionItem[];
  syncStatus: SyncStatus;
}

const DB_NAME = 'qrvault-inventory';
const DB_VERSION = 2;
const STORE_PRODUCTS = 'products';
const STORE_SESSIONS = 'sessions';

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

export function saveSession(db: IDBDatabase, session: ScanSession): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).add(session);
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

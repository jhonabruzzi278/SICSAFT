// Cliente del Conector QR (DOC-002). Es la única vía por la que la app debe
// tocar datos que no son locales al dispositivo — nunca escribir directo a la
// Base Patrimonial Central. Como CIS/SICSAFT CORE no existen todavía (HANDOFF
// sección 6, 4 preguntas abiertas sin responder), `LocalQrConnectorClient` es
// un stub explícito respaldado por el mismo IndexedDB de siempre: mismo
// contrato que usará la implementación HTTP real de TASK-007, sin la
// fidelidad exacta del protocolo de red (eso es responsabilidad de esa tarea).
import {
  getAllProducts,
  initInventoryDb,
  saveSession,
  type ProductVariant,
  type ScanSession,
} from './db';
import { ORGANIZATIONS, type Organization } from './organizations-data';

export interface ConnectorAsset {
  codigoQr: string;
  nombre: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  // Extensión no cubierta por DOC-002 todavía: el contrato documentado no
  // modela variantes/talles. Se mantiene para que el escaneo de códigos
  // "BASE-VARIANTE" (ver labels.ts) siga funcionando.
  variants?: ProductVariant[];
}

export interface AuthSessionResult {
  accessToken: string;
  expiresAt: string;
  organizaciones: Organization[];
}

export interface InventarioResult {
  inventarioId: string;
  estado: 'recibido' | 'rechazado';
  errores?: string[];
}

export interface InventarioEstado {
  estado: 'pendiente' | 'recibido' | 'rechazado';
  ultimoIntento: string;
}

export interface QrConnectorClient {
  authSession(operatorName: string): Promise<AuthSessionResult>;
  getCatalogo(organizacionId: string, areaId: string, ubicacionId: string): Promise<ConnectorAsset[]>;
  postInventario(session: Omit<ScanSession, 'id' | 'syncStatus'>): Promise<InventarioResult>;
  getInventarioEstado(inventarioId: string): Promise<InventarioEstado>;
}

class LocalQrConnectorClient implements QrConnectorClient {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = initInventoryDb();
    return this.dbPromise;
  }

  async authSession(operatorName: string): Promise<AuthSessionResult> {
    // Sin mecanismo de autenticación real definido todavía (HANDOFF sección 6,
    // pregunta 2) — token falso, no se persiste ni se usa para autorizar nada.
    return {
      accessToken: `local-${operatorName}`,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      organizaciones: ORGANIZATIONS,
    };
  }

  async getCatalogo(organizacionId: string, _areaId: string, _ubicacionId: string): Promise<ConnectorAsset[]> {
    // El stub ignora area/ubicación y devuelve todo el catálogo de la
    // organización (+ productos sin organización asignada, legacy/visibles en
    // cualquier lado) — necesario para que scan-resolve.ts pueda distinguir
    // "otra área"/"otra ubicación" de "no registrado" (TASK-005). Filtrar
    // server-side por ubicación exacta es algo a negociar con CORE (HANDOFF
    // sección 6, pregunta 1).
    const db = await this.getDb();
    const products = await getAllProducts(db);
    return products
      .filter((p) => !p.organizationId || p.organizationId === organizacionId)
      .map((p) => ({
        codigoQr: p.code,
        nombre: p.name,
        organizacionId: p.organizationId ?? '',
        areaId: p.areaId ?? '',
        ubicacionId: p.locationId ?? '',
        variants: p.variants,
      }));
  }

  async postInventario(session: Omit<ScanSession, 'id' | 'syncStatus'>): Promise<InventarioResult> {
    const db = await this.getDb();
    await saveSession(db, { ...session, syncStatus: 'local' });
    return { inventarioId: crypto.randomUUID(), estado: 'recibido' };
  }

  async getInventarioEstado(_inventarioId: string): Promise<InventarioEstado> {
    // Sin caller todavía — pantalla 12 (estado de sincronización), depende de
    // la cola offline de TASK-008.
    return { estado: 'recibido', ultimoIntento: new Date().toISOString() };
  }
}

export const qrConnector: QrConnectorClient = new LocalQrConnectorClient();

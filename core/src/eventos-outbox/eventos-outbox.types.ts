export interface EventoOutboxPendiente {
  id: string;
  eventoId: string;
  tipo: string;
  // Solo `escaneo_qr` lo trae (ver migracion 1755500000000) — el dispatcher lo usa para agrupar
  // varios escaneos de una misma sesion en un solo mensaje de cola (ARCHITECTURE.md 4).
  sesionId: string | null;
  // Resuelta por el trigger via JOIN contra `activos` (migracion 1755600000000, DOC-018 2) — el
  // worker de CIP la necesita para recalcular agregados sin leer la base `core` directamente
  // (RNF-01). Nullable: el evento pudo no resolver ningun activo (activo_id NULL o ya borrado).
  organizacionId: string | null;
}

// Mensaje publicado a la cola `cip-eventos` (BullMQ) — consumido por el worker de agregacion de
// CIP (cip/aidlc-docs/design-artifacts/ARCHITECTURE.md 1/4, DOC-018 5). El worker relee el
// dato real desde las APIs de lectura de CORE (GET /catalogo, GET /inventarios/:id) usando este
// mensaje solo como señal de "que recalcular", no como el dato completo.
export type EventosOutboxMensaje =
  | { kind: 'sesion-cerrada'; sesionId: string }
  | {
      kind: 'evento';
      eventoId: string;
      tipo: string;
      organizacionId: string | null;
    };

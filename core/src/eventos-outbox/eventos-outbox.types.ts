export interface EventoOutboxPendiente {
  id: string;
  eventoId: string;
  tipo: string;
  // Solo `escaneo_qr` lo trae (ver migracion 1755500000000) — el dispatcher lo usa para agrupar
  // varios escaneos de una misma sesion en un solo mensaje de cola (ARCHITECTURE.md §4).
  sesionId: string | null;
}

// Mensaje publicado a la cola `cip-eventos` (BullMQ) — consumido por el worker de agregacion de
// CIP (cip/aidlc-docs/design-artifacts/ARCHITECTURE.md §1/§4). El worker relee el dato real desde
// las APIs de lectura de CORE (GET /catalogo, GET /inventarios/:id) usando este mensaje solo como
// señal de "que recalcular", no como el dato completo.
export type EventosOutboxMensaje =
  | { kind: 'sesion-cerrada'; sesionId: string }
  | { kind: 'evento'; eventoId: string; tipo: string };

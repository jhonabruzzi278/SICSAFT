export const CORE_CLIENT_CONFIG = Symbol('CORE_CLIENT_CONFIG');
// Debe coincidir exactamente con core/src/common/auth/service-token.guard.ts — no hay paquete
// compartido entre CIP y CORE todavia (mismo caso ya aceptado entre CIS y CORE).
export const SERVICE_TOKEN_HEADER = 'x-internal-service-token';
// DOC-018 3 — tope de paginas al iterar GET /catalogo, evita un loop infinito si CORE
// devolviera un `total` inconsistente (defensa en profundidad, no se espera que ocurra).
export const CATALOGO_PAGE_SIZE = 100;
export const CATALOGO_MAX_PAGINAS = 1000;

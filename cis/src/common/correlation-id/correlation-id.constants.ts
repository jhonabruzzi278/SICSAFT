// Header transversal de trazabilidad (WAF 2) — no confundir con el `correlationId` de negocio
// que ya trae el payload de `POST /inventarios` (DOC-002 6, un campo del cliente, no un header
// HTTP). Este es el que cruza Captura → CIS → CORE → Base Patrimonial → CIP; ver
// core/src/common/correlation-id/ (mismo header, sin paquete compartido entre CIS y CORE).
export const CORRELATION_ID_HEADER = 'x-correlation-id';

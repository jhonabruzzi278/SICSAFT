// Config compartida entre los scripts de este directorio. URLs por nombre de servicio Docker
// (no localhost) — core y cip no publican puerto al host a propósito (ver docker-compose.yml),
// así que solo son alcanzables desde dentro de la red `sicsaft`, que es donde corre el servicio
// `k6` de docker-compose.yml.
export const CIS_URL = __ENV.CIS_URL || 'http://cis:3000';
export const CORE_URL = __ENV.CORE_URL || 'http://core:3001';
export const CIP_URL = __ENV.CIP_URL || 'http://cip:3002';

// Organización de seed precargada por core/migrations/1755000000001_seed-dev-fixture.ts — existe
// en cualquier stack local recién levantado, sin setup adicional.
export const ORGANIZACION_ID = __ENV.ORGANIZACION_ID || 'duoc-uc';

// CORE y CIP se protegen con el mismo header servicio-a-servicio (ver
// core/src/common/auth/service-token.guard.ts y su equivalente en cip/) — no es un token OIDC de
// operador, es el mismo secreto compartido que usa CIS para hablarle a CORE en producción.
export function coreHeaders() {
  return { 'x-internal-service-token': __ENV.CORE_SERVICE_TOKEN };
}

export function cipHeaders() {
  return { 'x-internal-service-token': __ENV.CIP_SERVICE_TOKEN };
}

// DOC-029 RF-A — nivel de producto contratado (ver DOC-025). NO es un dato de dominio: lo inyecta
// el .exe embebido de sicsaft-core (window.__SICSAFT_PORTAL_CONFIG__.VITE_SICSAFT_NIVEL, mismo
// canal de config runtime que la config OIDC — DOC-028 Fase C.0) leyendo instalacion.json, o una
// env var VITE_SICSAFT_NIVEL en devops/onprem. Para `npm run dev` suelto y deploys standalone eso
// no esta y se cae a `2` (portal completo), que es lo esperado en desarrollo.
export type NivelProducto = 1 | 2;

export function nivelActual(): NivelProducto {
  const crudo =
    window.__SICSAFT_PORTAL_CONFIG__?.VITE_SICSAFT_NIVEL ??
    import.meta.env.VITE_SICSAFT_NIVEL;
  return String(crudo) === '1' ? 1 : 2;
}

// Modulos retirados del CCP por completo, en cualquier nivel — "no es necesario" (usuario,
// 2026-08-31): Contratos (la vigencia/estado del contrato no se gestiona desde el portal del AFT)
// e Inventarios (el escaneo se hace en la APP QR del telefono; los resultados de cada sesion se
// ven en el Resumen, tarjeta "Sesiones de inventario"). Las paginas y los metodos de cliente
// quedan en el repo por si vuelven — el hub, el sidebar y las rutas no los exponen.
const MODULOS_RETIRADOS: ReadonlySet<string> = new Set([
  'contratos',
  'inventarios',
]);

// El CCP — Centro de Control Patrimonial (operacion, administracion y control) — esta COMPLETO en
// todos los niveles: activos (con alta manual), estructura (ABM de areas/ubicaciones/
// responsables), importaciones, etiquetas, auditoria. Lo unico gateado a Nivel 2 es lo que
// consume el CIP — Centro de Inteligencia Patrimonial (indicadores, analisis, dashboards
// ejecutivos): el modulo `dashboard`.
//
// Correccion 2026-09-02 (revierte DOC-029 RF-A A.3 / DOC-030): NOMENCLATURA.md dice "el CCP esta
// en todos los niveles, CIP entra en Nivel 2". El "Nivel 1 = CCP acotado" del diseño previo
// queda sin efecto — la diferencia Nivel 1<->2 es CIP, no CCP. (CCP ≠ CIP, Tomo IV: modificar un
// responsable = CCP; observar un indicador = CIP.)
const MODULOS_CIP: ReadonlySet<string> = new Set(['dashboard']);

export function moduloHabilitado(path: string): boolean {
  if (MODULOS_RETIRADOS.has(path)) return false;
  if (MODULOS_CIP.has(path)) return nivelActual() === 2;
  return true;
}

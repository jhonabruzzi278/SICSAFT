// DOC-029 RF-A — nivel de producto contratado (ver DOC-025). NO es un dato de dominio: lo inyecta
// el .exe embebido de sicsaft-core (window.__SICSAFT_PORTAL_CONFIG__.VITE_SICSAFT_NIVEL, mismo
// canal de config runtime que la config OIDC — DOC-028 Fase C.0) leyendo instalacion.json, o una
// env var VITE_SICSAFT_NIVEL en devops/onprem. Para `npm run dev` suelto y deploys standalone eso
// no esta y se cae a `2` (portal completo), que es lo esperado en desarrollo.
// Desde 2026-09-09 ningun modulo del CCP se decide por este valor (ver `moduloHabilitado` abajo).
// `nivelActual()` se mantiene igual porque el flag lo siguen inyectando el .exe
// (ipc/handlers.ts `asegurarServidoresPortales`), el `ARG VITE_SICSAFT_NIVEL` del Dockerfile y el
// Compose de devops/onprem: es el lector canonico de ese contrato, no codigo muerto por olvido.
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
// `cip` se suma a la lista el 2026-09-09 por pedido del usuario: el Centro de Inteligencia
// Patrimonial es del Directivo y se accede solo desde su portal (`core/frontend/`). Aca no queda
// ni ruta ni pagina — la entrada esta igual para que una URL vieja (`/cip?organizacionId=...`,
// que ademas se abria en pestana nueva) no encuentre un modulo habilitado por descuido.
const MODULOS_RETIRADOS: ReadonlySet<string> = new Set([
  'contratos',
  'inventarios',
  'cip',
]);

// El CCP — Centro de Control Patrimonial (operacion, administracion y control) — esta COMPLETO en
// todos los niveles: activos (con alta manual), estructura (ABM de areas/ubicaciones/
// responsables), importaciones, etiquetas, auditoria, y el Resumen Operativo basico (`dashboard`).
// Ningun modulo del CCP depende del nivel: la suite analitica de Nivel 2 (CIP — Centro de
// Inteligencia Patrimonial) es del Directivo, y vive en su portal (`core/frontend/`, ver
// core/frontend/src/lib/nivel.ts). El CCP no la enlaza ni la hospeda (usuario, 2026-09-09).
export function moduloHabilitado(path: string): boolean {
  return !MODULOS_RETIRADOS.has(path);
}

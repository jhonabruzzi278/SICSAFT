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
// 2026-08-31): Contratos (la vigencia/estado del contrato no se gestiona desde el portal del AFT).
// `cip` se suma a la lista el 2026-09-09 por pedido del usuario: el Centro de Inteligencia
// Patrimonial es del Directivo y se accede solo desde su portal (`core/frontend/`). Aca no queda
// ni ruta ni pagina — la entrada esta igual para que una URL vieja (`/cip?organizacionId=...`,
// que ademas se abria en pestana nueva) no encuentre un modulo habilitado por descuido.
// `activos` se suma el 2026-09-13 (Fase 3 de la reestructuracion CCP/CIP): el catalogo de Activos
// (alta/baja/reincorporacion/ficha tecnica/documentos) se mudo entero a una pestaña del CIP
// (core/frontend/src/pages/cip/ActivosTab.tsx) — el Profesional de AFT sigue pudiendo operarlo
// (el guard de CORE ahora acepta administrador-patrimonial O directivo), pero ya no tiene pantalla
// propia en el CCP.
// `inventarios` ("Controles de areas") se suma el mismo dia (Fase 4): la contrastacion de
// sesiones de control de area contra la BPI (Pantalla 8 / Escaneos) tambien se mudo a una pestaña
// del CIP (core/frontend/src/pages/cip/ControlesAreaTab.tsx). Es una pantalla de solo lectura —
// el traslado no cambio ningun guard de CORE.
// `etiquetas` se suma el mismo dia (Fase 5): a diferencia de los anteriores, esta NO se mudo al
// CIP -- se extrajo del ecosistema web por completo a un programa de escritorio standalone
// (herramientas/generador-qr/), de uso interno del equipo SICSAFT (no del cliente). Corre el ETL
// en modo dry-run localmente, sin hablar nunca con CIS/CORE.
const MODULOS_RETIRADOS: ReadonlySet<string> = new Set([
  'contratos',
  'cip',
  'activos',
  'inventarios',
  'etiquetas',
]);

// El CCP — Centro de Control Patrimonial (operacion, administracion y control) — esta COMPLETO en
// todos los niveles: estructura (ABM de areas/departamentos/responsables), importaciones y
// auditoria, mas el Resumen Operativo basico (`dashboard`). Ningun modulo del CCP depende del
// nivel: la suite analitica de Nivel 2 (CIP — Centro de Inteligencia Patrimonial) es del
// Directivo, y vive en su portal (`core/frontend/`, ver core/frontend/src/lib/nivel.ts). El CCP no
// la enlaza ni la hospeda (usuario, 2026-09-09).
export function moduloHabilitado(path: string): boolean {
  return !MODULOS_RETIRADOS.has(path);
}

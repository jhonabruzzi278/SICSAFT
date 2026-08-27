// Contrato de IPC entre el proceso principal (src/main/) y el renderer (src/renderer/) —
// vive en src/shared/ porque ambos lados lo importan (el preload lo usa para tipar
// contextBridge.exposeInMainWorld, el renderer lo usa para tipar window.sicsaftCore).
//
// Todo lo que toca la Admin REST API de Keycloak o arranca/para procesos vive en el proceso
// principal — el renderer nunca tiene el client secret ni el token de servicio, solo pide
// acciones por IPC y recibe resultados ya resueltos. Mismo principio de "el renderer no es
// confiable" que ya aplica ADR-002/ADR-004 al backend ("el punto de validación es CIS, no el
// token") — acá el equivalente es "el punto de validación/secretos es el proceso principal, no
// el renderer".

// ADR-005 (2026-08-27) — sin "redis": cis/core/cip dejaron de depender de Redis en todo el
// ecosistema (rate-limiter/device-registry de cis pasaron a memoria del propio proceso, la cola
// CORE->CIP pasa a pg-boss sobre Postgres) — un servicio menos que embeber acá.
export type NombreServicio = "postgres" | "keycloak" | "cis" | "core" | "cip";

export type EstadoServicio = "detenido" | "iniciando" | "listo" | "error";

export interface EstadoServicios {
  [servicio: string]: {
    estado: EstadoServicio;
    detalle?: string; // mensaje de error, si estado === 'error'
  };
}

// Paso 1 del wizard (ver aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Primer
// arranque") — equivalente a los parámetros de Invoke-BootstrapCliente en
// devops/onprem/lib/Bootstrap-Keycloak.psm1, pero sin AdminUsername/AdminPassword: acá el admin
// de Keycloak lo genera y gestiona el propio proceso principal al arrancar el servicio embebido,
// nunca lo tipea el vendedor (a diferencia del flujo de devops/onprem/, pensado para un operador
// técnico).
export interface DatosClienteInput {
  clienteNombre: string;
  organizacionId: string;
  nivel: 1 | 2;
}

export interface BootstrapClienteResultado {
  organizacionId: string;
}

// Paso 2 — alta del Director (KeycloakAdminService.crearUsuarioHuman del lado de cis/, portado acá
// para no depender de que cis/ ya esté arriba en este punto del wizard). organizacionId viaja
// desde el resultado del paso 1 (BootstrapClienteResultado) -- el Director necesita quedar como
// miembro de ESA organización con el rol "directivo", no alcanza con crear el usuario suelto.
export interface AltaDirectorInput {
  email: string;
  organizacionId: string;
}

export interface AltaDirectorResultado {
  userId: string;
  passwordInicial: string; // se muestra una sola vez en el wizard, nunca se persiste en disco
}

// API expuesta al renderer vía contextBridge (ver src/preload/index.ts). Cada método es
// ipcRenderer.invoke(...) por debajo — async siempre, nunca acceso directo a Node/Electron desde
// el renderer (contextIsolation: true, nodeIntegration: false, ver src/main/index.ts).
export interface SicsaftCoreApi {
  onEstadoServiciosChanged(
    callback: (estado: EstadoServicios) => void,
  ): () => void;
  getEstadoServicios(): Promise<EstadoServicios>;
  bootstrapCliente(
    input: DatosClienteInput,
  ): Promise<BootstrapClienteResultado>;
  altaDirector(input: AltaDirectorInput): Promise<AltaDirectorResultado>;
}

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
  // DOC-028 Fase B.2 — un contrato de CORE necesita al menos una sede (DOC-004 2/4). El wizard
  // provisiona la organización + contrato vigente + esta sede principal en la base patrimonial de
  // CORE (provisionarOrganizacionCore), no solo la Organization de Keycloak. Sedes adicionales se
  // agregan después desde el portal (módulo Áreas/Ubicaciones de ccp).
  sedePrincipalNombre: string;
}

export interface BootstrapClienteResultado {
  organizacionId: string;
}

// Ver instalacion-marker.ts -- le permite al wizard saltar directo al login si esta instalación
// ya tiene un cliente configurado (evita reintentar bootstrapCliente y romper con 409 contra un
// realm que ya existe).
export interface InstalacionCompleta {
  organizacionId: string;
  clienteNombre: string;
  // DOC-028 Fase C.1 -- IP de LAN detectada en el primer arranque. Cada relanzamiento la compara
  // con la IP actual de la PC; si cambió, el client OIDC de la APP QR (el único registrado con un
  // origen de LAN, no loopback) quedó apuntando a una dirección muerta y hay que reconfigurarlo.
  // Opcional: una instalación anterior a Fase C no la tiene -- getEstadoIpLan() la rellena con la
  // IP actual como línea base la primera vez.
  ipLan?: string;
}

// DOC-028 Fase C.1 -- el wizard consulta esto al relanzar, después de getInstalacionExistente().
// Si `cambio` es true, muestra la pantalla de reconfiguración (PasoIpCambio) antes del login.
export interface EstadoIpLan {
  cambio: boolean;
  // null = instalación anterior a Fase C (sin ipLan persistida) o sin instalación -- en ese caso
  // `cambio` es siempre false (no hay contra qué comparar).
  ipGuardada: string | null;
  ipActual: string;
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

// Paso 3 — alta del Profesional de AFT. Mismo mecanismo que altaDirector
// (KeycloakAdminService.crearUsuarioHuman portado a keycloak-bootstrap.ts crearUsuarioHumano),
// pero con el rol "administrador-patrimonial" -- el que cis/ asigna y ccp/ exige para este perfil
// (DOC-027 BUG-29). organizacionId viaja desde el resultado del paso 1, igual que el Director.
export interface AltaProfesionalAftInput {
  email: string;
  organizacionId: string;
}

export interface AltaProfesionalAftResultado {
  userId: string;
  passwordInicial: string; // se muestra una sola vez, nunca se persiste en disco
}

// CORE-RF-04 (alcance corregido 2026-08-28) -- el renderer nunca ve la WebContentsView en sí
// (vive fuera del DOM, superpuesta por el proceso principal, ver portal-login-service.ts). Lo
// único que cruza IPC es el rectángulo en coordenadas de pantalla del placeholder donde debe
// dibujarse -- ni tokens ni roles ni URLs de portal, todo eso se resuelve del lado del proceso
// principal.
export interface RectanguloPantalla {
  x: number;
  y: number;
  width: number;
  height: number;
}

// API expuesta al renderer vía contextBridge (ver src/preload/index.ts). Cada método es
// ipcRenderer.invoke(...) por debajo — async siempre, nunca acceso directo a Node/Electron desde
// el renderer (contextIsolation: true, nodeIntegration: false, ver src/main/index.ts).
export interface SicsaftCoreApi {
  onEstadoServiciosChanged(
    callback: (estado: EstadoServicios) => void,
  ): () => void;
  getEstadoServicios(): Promise<EstadoServicios>;
  getInstalacionExistente(): Promise<InstalacionCompleta | null>;
  // DOC-028 Fase C.1 -- estado de la IP de LAN al relanzar (getEstadoIpLan) y acción de
  // reconfiguración de ~1 clic (reconfigurarIpLan re-registra el redirectUri/webOrigins del client
  // OIDC de la APP QR en Keycloak y reescribe la ipLan persistida). Ambas devuelven el estado ya
  // evaluado -- reconfigurarIpLan lo devuelve post-reconfiguración (cambio === false).
  getEstadoIpLan(): Promise<EstadoIpLan>;
  reconfigurarIpLan(): Promise<EstadoIpLan>;
  bootstrapCliente(
    input: DatosClienteInput,
  ): Promise<BootstrapClienteResultado>;
  altaDirector(input: AltaDirectorInput): Promise<AltaDirectorResultado>;
  altaProfesionalAft(
    input: AltaProfesionalAftInput,
  ): Promise<AltaProfesionalAftResultado>;
  // forzarNuevoLogin=true (botón "Cambiar de usuario") le pide a Keycloak que ignore la sesión
  // SSO vigente y muestre el formulario de login de nuevo -- ver portal-login-service.ts
  // mostrarLoginYPortal.
  mostrarPortalEmbebido(
    bounds: RectanguloPantalla,
    forzarNuevoLogin?: boolean,
  ): Promise<void>;
  actualizarBoundsPortalEmbebido(bounds: RectanguloPantalla): void;
}

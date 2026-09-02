import {
  WebContentsView,
  type BrowserWindow,
  type Rectangle,
  type WebContents,
} from "electron";
import { randomBytes, createHash } from "node:crypto";
import { KEYCLOAK_CONFIG } from "./keycloak-service";
import { PUERTO_CCP, PUERTO_CORE_FRONTEND } from "./backend-configs";

// CORE-RF-04 (alcance corregido 2026-08-28) -- login único embebido que detecta el rol del
// Director/Profesional de AFT y muestra el portal correspondiente, en vez de un login por
// portal. Usa `WebContentsView` (no `BrowserView`, ver electron.d.ts de esta versión -- Electron
// 44 lo tiene soft-deprecated a favor de la API de composición `contentView.addChildView`) para
// mostrar la pantalla de login real de Keycloak dentro de la ventana de Electron -- visualmente
// es "un cuadrado con login más chico, correo y contraseña" (pedido explícito del usuario) porque
// es el formulario real de Keycloak, no uno propio reimplementado.
const CLIENT_ID_LOGIN = "sicsaft-core";
// Nunca se sirve de verdad -- Electron intercepta la navegación a este prefijo antes de que
// intente cargarlo (ver esperarCodigo), así que no importa que nada escuche en este puerto. Debe
// coincidir con el redirectUri que registra keycloak-bootstrap.ts (`puertoRenderer`, ver
// renderer-config.ts PUERTO_RENDERER).
const REDIRECT_URI_LOGIN = "http://127.0.0.1:58090/auth/callback";
const ROL_DIRECTIVO = "directivo";
// Bug real encontrado 2026-08-28: el rol de Keycloak que de verdad da acceso a ccp NO es
// "profesional-aft" -- ese nombre viene de devops/onprem/lib/Bootstrap-Keycloak.psm1 (creado acá
// también, ver ROLES_DE_NEGOCIO en keycloak-bootstrap.ts) pero según su propio comentario ahí es
// para la APP QR / un futuro portal liviano, un rol distinto. El rol real que "Designar
// Profesional de AFT" (cis/, directivo.constants.ts ADMINISTRADOR_PATRIMONIAL_ROLE) asigna, y que
// ccp/ mismo exige en sus propias páginas (ver ccp/src/pages/*.tsx "No tenés el rol
// administrador-patrimonial en esta organización"), es "administrador-patrimonial" -- verificado
// real designando un usuario desde el propio portal del Directivo.
const ROL_PROFESIONAL_AFT = "administrador-patrimonial";

interface TokenResponse {
  access_token: string;
}

interface ClaimsJwt {
  realm_access?: { roles?: string[] };
}

// Bug real encontrado 2026-08-28: el /health/ready de Keycloak (ver keycloak-service.ts) queda en
// verde un poco antes de que el realm "sicsaft" esté listo para servir tráfico interactivo de
// verdad -- mismo tipo de hallazgo que forzó el reintento de obtenerTokenAdmin en
// keycloak-bootstrap.ts, pero ese cubre las llamadas administrativas (Admin API), no esta pantalla
// de login interactiva. Sin esto, el primer intento de login después de cada arranque se quedaba
// colgado hasta el timeout de 60s de esperarCodigo() -- el usuario tenía que forzar un reload a
// mano para que funcionara. Se chequea el endpoint público bien conocido de OIDC del realm (no
// requiere token de admin) con el mismo criterio de reintentos cortos.
const REINTENTOS_REALM_LISTO = 5;
const ESPERA_ENTRE_REINTENTOS_REALM_MS = 800;

async function esperarRealmListo(): Promise<void> {
  const url = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/.well-known/openid-configuration`;
  for (let intento = 1; intento <= REINTENTOS_REALM_LISTO; intento += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Falla de red esperable mientras Keycloak todavía no acepta conexiones de verdad -- se
      // reintenta igual que un status no-ok.
    }
    if (intento < REINTENTOS_REALM_LISTO) {
      await new Promise((r) => setTimeout(r, ESPERA_ENTRE_REINTENTOS_REALM_MS));
    }
  }
  // No se corta el login acá -- si Keycloak sigue sin responder después de los reintentos, dejar
  // que el flujo normal (esperarCodigo, timeout de 60s) sea la única fuente de ese error, en vez
  // de duplicar el mensaje de fallo por dos caminos distintos.
}

function generarPkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

// Sin verificar firma acá a propósito -- este decode solo decide qué portal mostrar (una
// decisión de UI), nunca se usa para autorizar nada. El token real que cada portal usa después
// para hablarle a CIS sí se valida server-side en cada request (KeycloakAuthGuard), como
// siempre -- esto no es una superficie de autorización nueva.
function decodificarRoles(accessToken: string): string[] {
  const payload = accessToken.split(".")[1];
  if (!payload) return [];
  const claims = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf-8"),
  ) as ClaimsJwt;
  return claims.realm_access?.roles ?? [];
}

function resolverOrigenPortal(roles: string[]): string {
  if (roles.includes(ROL_DIRECTIVO)) {
    return `http://127.0.0.1:${PUERTO_CORE_FRONTEND}`;
  }
  if (roles.includes(ROL_PROFESIONAL_AFT)) {
    return `http://127.0.0.1:${PUERTO_CCP}`;
  }
  throw new Error(
    `El usuario no tiene rol "${ROL_DIRECTIVO}" ni "${ROL_PROFESIONAL_AFT}" -- no hay portal embebido para mostrarle.`,
  );
}

async function intercambiarCodigo(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const res = await fetch(
    `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI_LOGIN,
        client_id: CLIENT_ID_LOGIN,
        code_verifier: codeVerifier,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `Keycloak devolvió ${res.status} canjeando el código de login por un token.`,
    );
  }
  return (await res.json()) as TokenResponse;
}

// Escucha la navegación de la vista de login y resuelve apenas detecta un intento de ir al
// redirectUri -- corta esa navegación antes de que el navegador la intente de verdad (fallaría,
// nada escucha en ese puerto). `will-redirect` cubre el caso real (Keycloak responde con un 302
// tras el submit del form de login); `will-navigate` queda como respaldo por si algún flujo
// termina navegando ahí por otro camino (ej. un error mostrado como página propia).
// Keycloak "en frío" puede tardar (ver keycloak-service.ts, hasta 60s de JVM en frío) -- mismo
// valor acá para no cortar un login legítimo que todavía está esperando que la JVM responda.
const TIMEOUT_LOGIN_MS = 60_000;

function esperarCodigo(
  view: WebContentsView,
  stateEsperado: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Bug real encontrado 2026-08-28: mostrarLoginYPortal() ya no espera el resultado de
    // loadURL(authorizeUrl) (rechaza con ERR_FAILED apenas SSO silencioso redirige antes de que
    // termine de cargar, ver el comentario en mostrarLoginYPortal), así que sin este timeout un
    // fallo real (Keycloak inalcanzable, DNS) dejaría esta promesa colgada para siempre en vez de
    // fallar con un mensaje claro.
    // El WebContents puede haber sido destruido antes de que dispare el timeout: el usuario se
    // quedó en la pantalla previa (o el wizard cambió de paso y cerró la vista) sin completar el
    // login. Sin este guardia `view.webContents` es undefined y `.off()` tira una excepción no
    // capturada que mata el proceso main -- crash real 2026-08-31 ("Cannot read properties of
    // undefined (reading 'off')").
    const quitarListeners = (): void => {
      const wc: WebContents | undefined = view.webContents;
      if (wc && !wc.isDestroyed()) {
        wc.off("will-redirect", manejar);
        wc.off("will-navigate", manejar);
      }
    };

    const timeout = setTimeout(() => {
      quitarListeners();
      reject(
        new Error(
          "No se pudo completar el login en 60s -- ¿Keycloak sigue corriendo?",
        ),
      );
    }, TIMEOUT_LOGIN_MS);

    const manejar = (event: Electron.Event, url: string): void => {
      if (!url.startsWith(REDIRECT_URI_LOGIN)) return;
      event.preventDefault();
      clearTimeout(timeout);
      quitarListeners();

      const parsed = new URL(url);
      const error = parsed.searchParams.get("error");
      if (error) {
        reject(new Error(`Keycloak rechazó el login: ${error}`));
        return;
      }
      const code = parsed.searchParams.get("code");
      const state = parsed.searchParams.get("state");
      if (!code || state !== stateEsperado) {
        reject(
          new Error(
            "Respuesta de login inválida o expirada -- probá iniciar sesión de nuevo.",
          ),
        );
        return;
      }
      resolve(code);
    };
    view.webContents.on("will-redirect", manejar);
    view.webContents.on("will-navigate", manejar);
  });
}

// Una instancia por ventana principal -- dueña de la única WebContentsView embebida, que primero
// muestra el login de Keycloak y después se convierte en el portal detectado (mismo `session`
// que la ventana principal, por eso la cookie de sesión de Keycloak que dejó el login sigue
// activa cuando el portal hace su propio PKCE: SSO silencioso, no un segundo login visible).
export class PortalEmbebidoManager {
  private view: WebContentsView | null = null;

  constructor(private readonly ventana: BrowserWindow) {}

  actualizarBounds(bounds: Rectangle): void {
    this.view?.setBounds(bounds);
  }

  cerrar(): void {
    if (this.view) {
      const view = this.view;
      this.view = null;
      this.ventana.contentView.removeChildView(view);
      // Además de sacarla del árbol, hay que destruir el WebContents de verdad -- si no, sigue
      // vivo y navegando en segundo plano (nadie lo ve, pero sus listeners de esperarCodigo() no
      // se limpian solos) aunque ya no esté en pantalla. Root cause real encontrado 2026-08-28:
      // con React StrictMode (main.tsx) el efecto de PasoListoConLogin.tsx se monta dos veces en
      // dev, así que mostrarLoginYPortal() se llamaba dos veces con dos `state` distintos -- la
      // primera vista quedaba huérfana-pero-viva acá, y el redirect final terminaba comparado
      // contra el `state` de la llamada vieja. Ver también el guard en PasoListoConLogin.tsx.
      if (!view.webContents.isDestroyed()) {
        view.webContents.close();
      }
    }
  }

  // forzarNuevoLogin -- botón "Cambiar de usuario" del wizard (pedido explícito del usuario
  // 2026-08-28): el SSO silencioso (ver el comentario de la clase, arriba) es cómodo para el uso
  // normal (mismo usuario relanzando la app), pero al probar/cambiar de cuenta sin cerrar la app
  // entraba directo con la sesión de Keycloak anterior, sin mostrar el formulario. `prompt=login`
  // es el mecanismo estándar de OIDC para pedirle a Keycloak que ignore la sesión SSO existente y
  // fuerce el formulario de login de nuevo, sin necesidad de cerrar esa sesión (que otros usos
  // del SSO, si los hubiera, siguen viéndola vigente).
  async mostrarLoginYPortal(
    bounds: Rectangle,
    forzarNuevoLogin = false,
  ): Promise<void> {
    this.cerrar();
    await esperarRealmListo();
    const view = new WebContentsView({
      webPreferences: { sandbox: true, contextIsolation: true },
    });
    this.view = view;
    this.ventana.contentView.addChildView(view);
    view.setBounds(bounds);

    const { codeVerifier, codeChallenge } = generarPkce();
    const state = randomBytes(16).toString("base64url");

    const authorizeUrl = new URL(
      `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/auth`,
    );
    authorizeUrl.searchParams.set("client_id", CLIENT_ID_LOGIN);
    authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI_LOGIN);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "openid");
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", state);
    if (forzarNuevoLogin) {
      authorizeUrl.searchParams.set("prompt", "login");
    }

    const codigoPromise = esperarCodigo(view, state);
    // No se puede esperar esta promesa con el mismo criterio que loadURL(origenPortal) más abajo
    // -- bug real encontrado 2026-08-28: cuando la cookie de sesión de Keycloak ya es válida (SSO
    // silencioso, ej. un segundo login en la misma corrida), Keycloak responde /auth con un
    // redirect directo al REDIRECT_URI_LOGIN sin mostrar el formulario -- esperarCodigo() lo
    // intercepta con event.preventDefault() (ver más abajo), lo que hace que ESTA navegación
    // nunca "termine" a los ojos de Electron y la promesa de loadURL() rechace con ERR_FAILED,
    // aunque el código ya se haya obtenido bien vía codigoPromise. codigoPromise (nuestro propio
    // listener) es la única fuente de verdad real acá, no el resultado de loadURL().
    view.webContents.loadURL(authorizeUrl.toString()).catch(() => {
      // Rechazo esperado en el caso de SSO silencioso, ver comentario arriba -- si el problema es
      // real (Keycloak inalcanzable, DNS, etc.) codigoPromise nunca resuelve y esperarListo()/el
      // timeout de más arriba en la cadena de llamadas lo va a reflejar igual.
    });
    const codigo = await codigoPromise;

    const tokens = await intercambiarCodigo(codigo, codeVerifier);
    const roles = decodificarRoles(tokens.access_token);
    const origenPortal = resolverOrigenPortal(roles);

    await view.webContents.loadURL(origenPortal);
  }
}

# DOC-027: Bitácora de bugs reales — línea `sicsaft-core` (ADR-004 · ADR-005 · CORE-RF-01..05)

> Documento citable desde otros DOC-XXX y desde los README de sistema. Mismo esquema que los
> DOC-XXX numerados de antemano en `sicsaft-core/README.md` "Documentos relacionados".
>
> **Propósito**: consolidar en un solo lugar todos los bugs *reales* (reproducidos, no
> hipotéticos) encontrados y corregidos mientras se llevó `devops/onprem/` (Podman) a
> `sicsaft-core.exe` (Electron) — migración de identidad a Keycloak (ADR-004), salida de Redis
> del ecosistema (ADR-005), vendorizado de binarios, wizard de primer arranque, exposición de la
> APP QR por LAN, y el login único embebido (CORE-RF-04). Están dispersos en mensajes de commit,
> comentarios de código y los README de cada sistema — acá quedan juntos, con causa raíz y el
> commit donde se arreglaron.
>
> **Alcance**: rama `feat-sicsaft-core-wiring-cis-core-cip` y sus ramas previas de la misma
> línea (`feat-sicsaft-core-scaffold-electron`, `feat-adr005-sacar-redis-del-ecosistema`,
> `feat/adr-004-fase1..3-*`, `fix-devops-onprem-dominios-localhost`). No cubre bugs de fases
> anteriores del ecosistema (esos viven en el README del sistema que los encontró — ej. los dos
> bugs de la API de administración de Zitadel en `cis/README.md`, superados por ADR-004).

---

## Cómo leer esta bitácora

Cada bug lleva un ID local (`BUG-NN`), el sistema/archivo donde vive, la causa raíz real y el
commit que lo cerró. `(WIP)` marca los bugs del lote de CORE-RF-04 del 2026-08-28 — a la fecha de
este documento están en el árbol de trabajo, sin commitear todavía (ver "Estado" al final).

Los **patrones que se repiten** están al final — son la parte reusable: qué tipo de error volvió
a aparecer una y otra vez, para no volver a pisarlo en el próximo incremento.

---

## A. Identidad — migración Zitadel → Keycloak (ADR-004 Fases 1-3)

Contexto de diseño: [ADR-004](../../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md).

### BUG-01 — Los 4 portales tenían los endpoints de Zitadel hardcodeados
- **Dónde**: `app-qr-sicsaft/`, `ccp/`, `core/frontend/` — `src/lib/oidc/oidc-client.ts`
- **Síntoma**: el ADR-004 anticipaba que el flujo PKCE "no hacía falta tocarlo, solo la config
  de issuer/client". Falso: cada `oidc-client.ts` tenía `/oauth/v2/authorize` y `/oauth/v2/token`
  (rutas de Zitadel) escritas a mano.
- **Causa raíz**: en Keycloak esas rutas son `/protocol/openid-connect/auth` y
  `/protocol/openid-connect/token`, relativas al issuer del realm.
- **Fix**: endpoints reescritos contra Keycloak en los 4 portales. Commit `2287eab` (Fase 2).

### BUG-02 — Los realm roles de Keycloak son globales por usuario, no anidados por organización
- **Dónde**: `cis/src/common/auth/keycloak-auth.guard.ts`, `ccp/src/lib/oidc/oidc-client.ts`
- **Síntoma**: el claim propietario de Zitadel (`urn:zitadel:iam:org:project:roles`) firmaba
  `{"<rol>": {"<orgId>": "<nombre>"}}` — rol *por organización* dentro del JWT. El ADR asumía
  que Keycloak podía hacer lo mismo.
- **Causa raíz**: Keycloak firma `realm_access.roles`, una lista plana **global** por usuario.
  Desde el JWT del cliente ya no se puede saber en qué organización el usuario tiene el rol,
  solo si lo tiene en alguna.
- **Fix**: `KeycloakAuthGuard` resuelve `rolesPorOrganizacion` vía `KeycloakAdminService`
  (grupos `{organizacionId}::{rol}`, caché corta en memoria) en vez de leerlo del token. En los
  portales el chequeo de rol pasa a ser solo-UI ("¿tiene el rol en alguna org?") — el
  enforcement real siempre vivió server-side en CIS. Commits `04e900a` (Fase 1), `2287eab`
  (Fase 2). Es más un hallazgo de diseño que un bug, pero rompió una suposición explícita del
  ADR — queda documentado acá por eso.

### BUG-03 — Los 6 suites e2e de `cis` no compilaban tras la Fase 1
- **Dónde**: `cis/test/support/e2e-app.ts`, `cis/test/support/jwt.ts`, `cis/test/jest-e2e.setup.ts`
- **Síntoma**: `npm run test:e2e` fallaba con error de resolución de módulos **antes de correr
  un solo test**. Invisible en `npm run test:cov` porque unit y e2e usan configs de Jest
  separadas y `cis-ci.yml` los corre como pasos independientes.
- **Causa raíz**: `e2e-app.ts`/`jwt.ts` importaban módulos borrados en la Fase 1
  (`zitadel-auth.constants`, `zitadel-admin.service`); `jest-e2e.setup.ts` seteaba `ZITADEL_*`
  en vez de `KEYCLOAK_*`.
- **Fix**: `firmarTokenKeycloak` reemplaza a `firmarTokenZitadel` (firma solo el claim
  `organization`, sin roles anidados); overrides y env defaults migrados a `KEYCLOAK_*`. Commit
  `d0239fa`.

### BUG-04 — Los specs de guard de rol firmaban dos roles para el mismo `sub`
- **Dónde**: `cis/` e2e specs con guard de rol, `ccp/` unit tests
- **Causa raíz**: el guard cachea `rolesPorOrganizacion` por `sub`, y en Keycloak el rol lo
  resuelve el servidor por usuario, no el JWT presentado — a diferencia de Zitadel, un mismo
  usuario de prueba no puede "firmar" dos roles distintos.
- **Fix**: los specs usan sujetos JWT distintos por persona y stubean
  `KeycloakAdminService.resolverRolesPorOrganizacionDeUsuario`. Commits `d0239fa`, `2287eab`.

### BUG-05 — `docker-compose.yml` de onprem con env vars desincronizadas de los Dockerfiles
- **Dónde**: `devops/onprem/docker-compose.yml`
- **Causa raíz**: los Dockerfiles de `cis` y los 4 frontends se renombraron a `KEYCLOAK_*` /
  `VITE_KEYCLOAK_*` en la Fase 2, pero el `docker-compose.yml` seguía pasando `ZITADEL_*` —
  un `docker build` hoy habría horneado el issuer vacío.
- **Fix**: env vars y build-args sincronizados en la Fase 3. Commit `9bff6b6`.

### BUG-06 — `Bootstrap-Keycloak.psm1`: `Invoke-WebRequest` sin `-UseBasicParsing`
- **Dónde**: `devops/onprem/lib/Bootstrap-Keycloak.psm1`
- **Causa raíz**: `Invoke-WebRequest` sin `-UseBasicParsing` falla en modo no interactivo
  (sin sesión de Internet Explorer para parsear el DOM de la respuesta).
- **Fix**: `-UseBasicParsing` en todas las llamadas. Commit `9bff6b6`.

### BUG-07 — Un módulo de PowerShell importado no hereda `$ErrorActionPreference`
- **Dónde**: `devops/onprem/lib/Bootstrap-Keycloak.psm1` + `bootstrap-keycloak.ps1`
- **Causa raíz**: un `.psm1` importado con `Import-Module` no hereda el
  `$ErrorActionPreference = 'Stop'` del script que lo llama — un error dentro de una función del
  módulo no cortaba el bootstrap, seguía de largo con estado a medias.
- **Fix**: el módulo fija su propio `$ErrorActionPreference`. Commit `9bff6b6`.

---

## B. Contexto seguro y armado de URLs (PKCE / `crypto.subtle`)

### BUG-08 — Los dominios `.test` no son "secure context" → PKCE roto
- **Dónde**: `devops/onprem/instalar-cliente.ps1` (generaba `*.sicsaft.test`), todos los portales
- **Síntoma**: el login de cualquier portal contra el stack de onprem fallaba: `window.crypto.subtle`
  era `undefined`.
- **Causa raíz**: el navegador solo expone `crypto.subtle` (que PKCE necesita para el
  `code_challenge` S256) en un *secure context*. `http://<host>.localhost` **sí** lo es por
  spec; `http://<host>.test` **no**.
- **Fix**: dominios `.localhost` en todo `devops/onprem/`. Commit `b290e58`. Este hallazgo es el
  que disparó todo el pivote a `sicsaft-core.exe` — ver `requirements/INTENT.md` "Por qué ahora".

### BUG-09 — `new URL('/protocol/...', issuer)` descarta el path del issuer
- **Dónde**: `app-qr-sicsaft/`, después `ccp/`, después `core/frontend/` — `src/lib/oidc/oidc-client.ts`
- **Síntoma**: Keycloak devuelve **"Page not found"** en el `authorize`/`token`. No era el
  certificado ni CORS.
- **Causa raíz**: `new URL('/protocol/openid-connect/auth', issuer)` con **slash inicial** es una
  ruta absoluta — reemplaza el path completo de la base, no lo extiende. El issuer es
  `https://<host>/realms/sicsaft`, así que la URL resultante apunta a
  `https://<host>/protocol/openid-connect/auth` (sin `/realms/sicsaft`).
- **Fix**: helper `endpointUrl(issuer, path)` — path **relativo** (sin slash inicial) contra el
  issuer normalizado con `/` final. Encontrado 3 veces: `app-qr-sicsaft` contra un Android físico
  (commit `165f5cc`), luego re-aplicado a `ccp` y `core/frontend` **(WIP 2026-08-28)** cuando el
  login embebido los ejercitó por primera vez.

### BUG-10 — `app-qr-sicsaft` servido por HTTP plano → sin `crypto.subtle` en el celular
- **Dónde**: `app-qr-sicsaft/vite.config.ts`, `ScanPage`
- **Síntoma**: `crypto.subtle` y `crypto.randomUUID` no existían en un celular real — `ScanPage`
  rompía. Bug encontrado con hardware físico, no un caso hipotético.
- **Causa raíz**: mismo que BUG-08 — `http://<ip-lan>:<puerto>` no es secure context desde el
  teléfono.
- **Fix**: `vite preview` por HTTPS autofirmado (`@vitejs/plugin-basic-ssl`). Commit `165f5cc`.

### BUG-11 — `127.0.0.1` desde el teléfono apunta a sí mismo
- **Dónde**: `sicsaft-core/src/main/services/{keycloak-service,keycloak-bootstrap,backend-configs}.ts`
- **Causa raíz**: todo el wiring asumía `127.0.0.1` — válido para la ventana de Electron, pero la
  APP QR corre en el teléfono. `KC_HOSTNAME`, el redirect URI del client `app-qr-sicsaft` y
  `CIS_CORS_ORIGIN` tenían que resolver a la IP de LAN de la PC del Director.
- **Fix**: `lan-ip.ts` (heurística de IP de LAN) + `obtenerOrigenAppQr()` centralizado.
  Commit `165f5cc` (CORE-RF-05).

---

## C. Empaquetado de Electron (main / preload / renderer)

### BUG-12 — El preload nunca cargaba: `.js` vs `.mjs`
- **Dónde**: `sicsaft-core/src/main/index.ts`
- **Síntoma**: `ENOENT` real — ventana en blanco.
- **Causa raíz**: `index.ts` apuntaba el preload a `preload/index.js`, pero electron-vite compila
  `.mjs` porque `package.json` tiene `"type": "module"`.
- **Fix parcial → real**: corregido a `.mjs` → nuevo error ("Cannot use import statement outside
  a module", ver BUG-13). Commit `7163199`.

### BUG-13 — Electron con `sandbox: true` no soporta ESM en el preload
- **Dónde**: `sicsaft-core/electron.vite.config.ts`, `src/main/index.ts`
- **Causa raíz**: el loader de preload sandboxeado de Electron solo entiende CommonJS, bajo
  cualquier extensión.
- **Fix**: forzar el build del preload a CJS + extensión `.cjs` (Node/Electron siempre tratan
  `.cjs` como CommonJS sin importar `"type": "module"`). Commit `7163199`.

### BUG-14 — El splash desmontaba el wizard entero cuando `cis` pasaba por "iniciando"
- **Dónde**: `sicsaft-core/src/renderer/src/App.tsx`
- **Síntoma**: al llegar al paso 1 del wizard (`bootstrapCliente`, que arranca `cis` a
  propósito), `<WizardApp>` se desmontaba y volvía a montarse en el paso 1 vacío — se perdía todo
  el progreso. El vendedor reenviaba el formulario y chocaba con un realm `sicsaft` que ya
  existía → **HTTP 409**.
- **Causa raíz**: `App.tsx` gateaba el splash contra los **5** servicios "listo", pero `cis`
  arranca en medio del wizard por diseño, no con `iniciarTodo()`.
- **Fix**: el gate solo exige los 4 servicios que arrancan siempre (`postgres`/`keycloak`/`core`/
  `cip`); el estado de `cis` durante el paso 1 lo maneja el botón "Continuar". Commit `7163199`.

### BUG-15 — CSP sin `'unsafe-eval'` bloqueaba en silencio el HMR de Vite en dev
- **Dónde**: `sicsaft-core/src/renderer/index.html`
- **Nota**: no era la causa de la ventana en blanco (eso era el preload) — es una advertencia de
  seguridad de Electron aparte. No hace falta en el build de producción (Vite bundlea sin
  `eval`). Documentado en el propio `index.html`. Commit `7163199`.

### BUG-16 — `extraResources` de electron-builder no copia carpetas `node_modules`
- **Dónde**: `sicsaft-core/scripts/electron-builder-after-pack.cjs`
- **Causa raíz**: el `filter` de `extraResources` trata cualquier carpeta llamada literalmente
  `node_modules` como caso especial de su propia resolución de dependencias — nunca la copia.
- **Fix**: hook `afterPack` que las copia a mano con `fs.cpSync`. El hook es `.cjs` (no `.js`)
  porque `"type": "module"` rompe `require()` en un hook ejecutado por electron-builder.
  Commit `9e4fe11`.

### BUG-17 — Vitest recogía specs de Jest copiados a `release/`
- **Dónde**: `sicsaft-core/vitest.config.ts`
- **Síntoma**: tras la Fase 8, `release/` (empaquetado por electron-builder) contiene una copia de
  `core/src/**/*.spec.ts` (specs de Jest). Vitest los recogía como tests propios y explotaba con
  `describe is not defined`.
- **Fix**: `release/` excluido en `vitest.config.ts`. Commit `11d35ed`.

### BUG-18 — `eslint.config.mjs` sin globals de Node para `scripts/*.cjs`
- **Dónde**: `sicsaft-core/eslint.config.mjs`
- **Causa raíz**: `scripts/electron-builder-after-pack.cjs` usa `require`/`module`/`__dirname`,
  sin definir en la config de ESLint.
- **Fix**: bloque de config con globals de Node para `scripts/*.cjs`. Commit `11d35ed`.

### BUG-19 — DevTools no se abría solo → diagnosticar un renderer roto a ciegas
- **Dónde**: `sicsaft-core/src/main/index.ts`
- **Fix**: `openDevTools({ mode: "detach" })` cuando `!app.isPackaged`. Commit `7163199`.

---

## D. Orquestación de procesos embebidos (`cis` / `core` / `cip`)

### BUG-20 — Las 3 rutas relativas de servicio tenían un `../` de más
- **Dónde**: `sicsaft-core/src/main/services/{postgres-service,keycloak-service,node-backend-service}.ts`
- **Causa raíz**: resolvían un directorio **afuera** de `sicsaft-core/`.
- **Fix**: rutas corregidas. Commit `a6c5f0e`.

### BUG-21 — `spawn()` de Windows no puede ejecutar `.bat` directo
- **Dónde**: `sicsaft-core/src/main/services/managed-process.ts`
- **Síntoma**: `EINVAL` al arrancar Keycloak (`kc.bat`).
- **Fix**: `shell: true` **solo** para comandos `.bat`, no siempre. Commit `a6c5f0e`.

### BUG-22 — `node-pg-migrate` resuelve `dir: 'migrations'` contra el `cwd` del proceso hijo
- **Dónde**: `sicsaft-core/src/main/services/migration-runner.ts`
- **Causa raíz**: la ruta relativa `dir: 'migrations'` se resuelve contra el `cwd` del proceso
  hijo, no contra dónde vive el script — las migraciones de `core`/`cip` no se encontraban.
- **Fix**: `cwd` explícito por servicio. Commit `a6c5f0e`.

---

## E. Keycloak 26 — comportamiento real vs. documentado

Detalle de versiones/fuentes en `sicsaft-core/resources/README.md`.

### BUG-23 — `/health/ready` vive en un puerto de management separado
- **Dónde**: `sicsaft-core/src/main/services/keycloak-service.ts`
- **Causa raíz**: Keycloak 26 expone `/health/ready` en una interfaz de management separada del
  puerto HTTP principal (default 9000, acá fijo en `KC_HTTP_MANAGEMENT_PORT` = 58081).
  `keycloak-service.ts` apuntaba al puerto HTTP → nunca quedaba "listo".
- **Fix**: apuntar al puerto de management. Commit `a6c5f0e`.

### BUG-24 — `--db` / `--health-enabled` son opciones de build-time, no de runtime
- **Dónde**: `sicsaft-core/resources/keycloak/` (paso de empaquetado)
- **Síntoma**: `kc.bat start --optimized` con esas opciones sin `kc.bat build` previo →
  `ERROR: build time options have values that differ from what is persisted` → el proceso muere
  sin arrancar.
- **Fix**: correr una vez `kc.bat build --db=postgres --health-enabled=true` en tiempo de
  empaquetado. Hoy manual — automatizarlo como paso de `electron-builder` está pendiente (ver
  `00_PROJECT_METADATA.md` "Próximo paso sugerido"). Commit `a6c5f0e`.

### BUG-25 — Keycloak 26.0.0-26.0.5: `POST /organizations/{id}/members` roto
- **Dónde**: bug de Keycloak, no del repo — se resuelve eligiendo la versión vendorizada
- **Síntoma**: `HTTP 400 "User does not exist"` con el body y los headers correctos.
- **Causa raíz**: bug real de Keycloak, arreglado en 26.0.6. Confirmado contra un 26.0.0 real y
  un 26.0.8 real con el mismo código sin cambios. Discusión oficial:
  `github.com/keycloak/keycloak/discussions/34230`.
- **Fix**: vendorizar Keycloak **26.0.8**. Commit `a6c5f0e`.

### BUG-26 — `POST /organizations/{id}/members`: HTTP 415 por content-type y body sin comillas **(WIP)**
- **Dónde**: `cis/src/keycloak-admin/keycloak-admin.service.ts` (`agregarMiembroSiHaceFalta`)
- **Síntoma**: `HTTP 415 "content-type header value did not match @Consumes"`.
- **Causa raíz**: este endpoint es el único de todo el archivo cuyo body es un string plano.
  axios pone `Content-Type: application/json` automático para bodies **objeto**, pero un string
  lo manda tal cual, sin header. Keycloak espera literalmente un string JSON (`"uuid"`, con
  comillas) con ese content-type explícito. Verificado real: `curl -d '"$USER_ID"' -H
  'Content-Type: application/json'` → 201.
- **Fix**: `JSON.stringify(userId)` + header `Content-Type: application/json` explícito
  (el helper `post()` acepta `options.headers`). Spec actualizado.

### BUG-27 — `obtenerTokenAdmin` contra `realms/master` da HTTP 500 en frío **(WIP)**
- **Dónde**: `sicsaft-core/src/main/keycloak-bootstrap.ts`
- **Síntoma**: HTTP 500 real, visto 2 veces distintas, siempre justo después de que Keycloak
  termina de arrancar (`crearBasesDeDatosSiHacenFalta`/`iniciarCis` llamándolo apenas queda
  "listo"). Nunca en corridas ya calientes.
- **Causa raíz**: `/health/ready` queda verde un poco antes de que el endpoint de token del realm
  master esté realmente listo.
- **Fix**: reintentos (5 × 800ms) **solo ante 5xx** — un 4xx (password real incorrecto) se
  propaga de inmediato.

### BUG-28 — `/health/ready` verde antes de que el realm `sicsaft` sirva tráfico interactivo **(WIP)**
- **Dónde**: `sicsaft-core/src/main/services/portal-login-service.ts` (`esperarRealmListo`)
- **Síntoma**: el primer intento de login después de cada arranque se colgaba hasta el timeout de
  60s — el usuario tenía que forzar un reload a mano.
- **Causa raíz**: mismo tipo que BUG-27, pero para la pantalla de login interactiva del realm
  `sicsaft` (no las llamadas administrativas al realm master).
- **Fix**: chequear el `.well-known/openid-configuration` público del realm (sin token de admin)
  con reintentos cortos antes de mostrar la vista de login.

---

## F. CORE-RF-04 — login único embebido y su lote de bugs (2026-08-28) **(todo WIP)**

Contexto de diseño: `design-artifacts/ARCHITECTURE.md` "Los portales embebidos" y
`requirements/REQUIREMENTS.md` CORE-RF-04. Estos bugs aparecieron al cablear el login embebido
por primera vez y probarlo de punta a punta.

### BUG-29 — Nombre de rol equivocado: `profesional-aft` vs `administrador-patrimonial`
- **Dónde**: `sicsaft-core/src/main/keycloak-bootstrap.ts` (`ROLES_DE_NEGOCIO`),
  `src/main/services/portal-login-service.ts`
- **Causa raíz**: `profesional-aft` se portó tal cual de `devops/onprem/lib/Bootstrap-Keycloak.psm1`
  — pero según su propio comentario ahí ese nombre es para la APP QR / un futuro portal liviano,
  un rol distinto. El rol que `cis` efectivamente asigna y valida para el Profesional de AFT
  (`cis/src/directivo/directivo.constants.ts` `ADMINISTRADOR_PATRIMONIAL_ROLE`) y que `ccp` exige
  literal en sus páginas es **`administrador-patrimonial`**. Sin ese rol creado en el realm,
  `crearGrant()` de `cis` agrega el usuario al grupo pero nunca puede asignarle el role mapping
  (el rol no existe) → el JWT nunca trae el rol → `portal-login-service.ts` no puede rutear al
  usuario a ningún portal. "Designar Profesional de AFT" reportaba éxito igual — gap silencioso
  del lado de `cis`, a revisar aparte.
- **Fix**: `administrador-patrimonial` en `ROLES_DE_NEGOCIO`. Verificado real designando un
  usuario desde el portal del Directivo.

### BUG-30 — El wizard reintentaba crear el realm en cada relanzamiento → HTTP 409
- **Dónde**: `sicsaft-core/src/main/services/instalacion-marker.ts` (nuevo),
  `src/renderer/src/wizard/WizardApp.tsx`
- **Causa raíz**: cada instalación de `sicsaft-core.exe` es de un solo cliente, pero nada impedía
  que el wizard reintentara el paso 1 (`bootstrapCliente`, crea el realm `sicsaft`) en cada
  relanzamiento. Con `postgres-data` persistido (el caso normal de un desktop app real, no solo
  de dev) Keycloak ya tiene el realm de la corrida anterior → **409 Conflict**.
- **Fix**: `instalacion.json` en `userData` (mismo patrón que `keycloak-admin.json`). El wizard
  lo consulta al arrancar y salta directo al login si esta instalación ya tiene un cliente
  configurado. Limitación aceptada: si la app se cierra entre `bootstrapCliente` y `altaDirector`,
  el marcador ya existe y el próximo arranque salta al login sin Director creado — recuperarse de
  ese estado a medias no está resuelto (no hace falta para este incremento).

### BUG-31 — `iniciarCis()` solo se llamaba desde `bootstrapCliente`
- **Dónde**: `sicsaft-core/src/main/ipc/handlers.ts`, `src/main/keycloak-bootstrap.ts`
  (`resolverCredencialesClienteAdminCis`, nuevo)
- **Causa raíz**: en un relanzamiento donde el wizard se saltea (BUG-30), `bootstrapCliente`
  nunca corre → `cis` se quedaba abajo para siempre.
- **Fix**: `getInstalacionExistente` arranca `cis` en la rama del wizard salteado. El
  `client_secret` de `cis-admin` nunca se persiste (vive solo en memoria de la corrida que lo
  generó) — se recupera pidiéndoselo de nuevo a la Admin API (`GET /clients/{uuid}/client-secret`),
  el client ya existe con sus roles ya asignados.

### BUG-32 — `iniciarCis()` no idempotente + StrictMode dispara el segundo camino dos veces
- **Dónde**: `sicsaft-core/src/main/services/service-orchestrator.ts`
- **Causa raíz**: `iniciarCis()` ahora se llama tanto desde `bootstrapCliente` como desde
  `getInstalacionExistente`, y React StrictMode en dev puede disparar ese segundo camino dos
  veces.
- **Fix**: guarda contra la carrera chequeando `this.estado.cis?.estado` (que se marca
  "iniciando" de forma síncrona, antes de cualquier `await`) — más seguro que chequear
  `this.procesos` (que recién se llena después de un `await`).

### BUG-33 — El password de admin de Keycloak se regeneraba en cada arranque
- **Dónde**: `sicsaft-core/src/main/services/keycloak-service.ts` (`obtenerOGenerarAdmin`)
- **Síntoma**: funcionaba la primera vez (Postgres/Keycloak de cero, `KEYCLOAK_ADMIN_PASSWORD`
  crea el admin con ese valor), pero **todo reinicio siguiente** fallaba con 401 —
  `obtenerTokenAdmin()` usaba el password nuevo de esta corrida, pero el admin ya existía en
  `postgres-data` persistido con el password de la corrida anterior. Keycloak solo usa esa env
  var la primera vez que arranca contra una base vacía.
- **Fix**: persistir en `keycloak-admin.json` (`mode 0o600`, mismo directorio que `postgres-data`)
  y reusar mientras exista. Autocura si `postgres-data` se borra pero el archivo de credenciales
  sobrevive (Keycloak crea el admin de nuevo con ESE password en la base fresca).

### BUG-34 — SSO silencioso: `loadURL(authorizeUrl)` rechaza con `ERR_FAILED` con el código ya obtenido
- **Dónde**: `sicsaft-core/src/main/services/portal-login-service.ts` (`mostrarLoginYPortal`)
- **Causa raíz**: cuando la cookie de sesión de Keycloak ya es válida (segundo login en la misma
  corrida), Keycloak responde `/auth` con un redirect directo al `redirect_uri` sin mostrar el
  formulario. `esperarCodigo()` lo intercepta con `event.preventDefault()` → esa navegación
  nunca "termina" a ojos de Electron → la promesa de `loadURL()` rechaza con `ERR_FAILED`,
  aunque el código ya se haya obtenido bien.
- **Fix**: no esperar el resultado de `loadURL(authorizeUrl)` — `codigoPromise` (el listener
  propio de `will-redirect`/`will-navigate`) es la única fuente de verdad.

### BUG-35 — Sin timeout en `esperarCodigo()` → promesa colgada para siempre
- **Dónde**: `sicsaft-core/src/main/services/portal-login-service.ts` (`esperarCodigo`)
- **Causa raíz**: al no esperar `loadURL()` (BUG-34), un fallo real (Keycloak inalcanzable, DNS)
  dejaría la promesa colgada para siempre en vez de fallar con un mensaje claro.
- **Fix**: timeout de 60s (mismo valor que el arranque en frío de la JVM de Keycloak) que
  limpia los listeners y rechaza con un mensaje accionable.

### BUG-36 — React StrictMode → dos flujos OIDC concurrentes con `state` distinto
- **Dónde**: `sicsaft-core/src/renderer/src/wizard/PasoListoConLogin.tsx`,
  `src/main/services/portal-login-service.ts` (`cerrar`)
- **Causa raíz**: `mostrarPortalEmbebido` arranca un flujo OIDC completo (`state`/PKCE + una
  `WebContentsView` nativa) — no es idempotente como un efecto de suscripción. StrictMode
  montando el efecto dos veces (mount → cleanup → mount) disparaba dos flujos con dos `state`
  distintos, y el redirect final terminaba comparado contra el `state` de la llamada vieja.
- **Fix**: guard `ultimoIntentoDisparado` (ref) en `PasoListoConLogin.tsx` — si el efecto se
  re-ejecuta con el mismo `intentoLogin`, no dispara de nuevo. Más el cierre real de la vista
  vieja en `cerrar()` (ver BUG-37).

### BUG-37 — `WebContentsView` no destruida al cerrar → sigue navegando en segundo plano
- **Dónde**: `sicsaft-core/src/main/services/portal-login-service.ts` (`cerrar`)
- **Causa raíz**: sacarla del árbol (`removeChildView`) no destruye su `WebContents` — sigue
  vivo y navegando, y sus listeners de `esperarCodigo()` no se limpian solos.
- **Fix**: `view.webContents.close()` además de `removeChildView`.

### BUG-38 — `onPortalCargado` como arrow inline en las deps del efecto → re-dispara el flujo
- **Dónde**: `sicsaft-core/src/renderer/src/wizard/PasoListoConLogin.tsx`
- **Causa raíz**: `WizardApp` pasa `onPortalCargado` como arrow inline — una instancia nueva por
  render. Si estuviera en el array de deps del efecto, cada render re-ejecutaría el efecto y
  volvería a llamar `mostrarPortalEmbebido` (la misma doble-invocación de BUG-36, por otra vía).
- **Fix**: `onPortalCargadoRef` — el ref siempre apunta a la versión más reciente sin re-ejecutar
  el efecto.

### BUG-39 — Cambiar el shape del árbol JSX alrededor del nodo con el ref → vista clavada en tamaño chico
- **Dónde**: `sicsaft-core/src/renderer/src/wizard/PasoListoConLogin.tsx`
- **Síntoma**: "agrandé la pantalla y no se ve bien" — el placeholder se veía grande en el DOM
  pero el `WebContentsView` real (dibujado por el proceso principal según el último bounds
  recibido) se quedaba con el tamaño chico de antes.
- **Causa raíz**: al pasar `portalCargado` a true se devolvía un árbol JSX distinto por rama.
  React trata el `<div ref>` como un elemento nuevo, lo desmonta y crea otro — el `ResizeObserver`
  queda observando el nodo viejo (ya fuera del DOM) y nunca más dispara.
- **Fix**: el `<div ref>` es el **mismo nodo** en las dos variantes — solo cambia su `className`,
  nunca la forma del árbol alrededor.

### BUG-40 — El botón "Cambiar de usuario" desaparecía / lo tapaba la vista nativa
- **Dónde**: `sicsaft-core/src/renderer/src/wizard/PasoListoConLogin.tsx`
- **Causa raíz**: un botón puesto solo debajo del cuadro de login desaparece cuando
  `portalCargado` pasa a true (esa rama del layout ya no lo renderiza). Y un `WebContentsView`
  nativo se dibuja **fuera** del árbol de compositing del DOM — tapa cualquier HTML "debajo" de
  sus bounds, no hay z-index que gane.
- **Fix**: la franja de "Cambiar de usuario" vive SIEMPRE presente (antes y después de
  `portalCargado`), en su propio div, **fuera** del rectángulo que se le manda a
  `mostrarPortalEmbebido`/`actualizarBoundsPortalEmbebido`.

### BUG-41 — "Cambiar de usuario" entraba con la sesión SSO anterior sin mostrar el formulario
- **Dónde**: `sicsaft-core/src/main/services/portal-login-service.ts` (`mostrarLoginYPortal`)
- **Causa raíz**: el SSO silencioso (cómodo para el uso normal) hacía que al querer cambiar de
  cuenta sin cerrar la app se entrara directo con la sesión de Keycloak vigente.
- **Fix**: `prompt=login` (mecanismo estándar de OIDC) cuando `forzarNuevoLogin` — Keycloak
  ignora la sesión SSO y fuerza el formulario, sin cerrar esa sesión.

### BUG-42 — `getInstalacionExistente()` sin `.catch()` → wizard trabado en "Verificando instalación…"
- **Dónde**: `sicsaft-core/src/renderer/src/wizard/WizardApp.tsx`
- **Causa raíz**: un fallo real (ej. Keycloak devolviendo 500 al arrancar, BUG-27) quedaba como
  excepción no manejada en la consola y `verificandoInstalacion` nunca pasaba a `false` — el
  wizard se quedaba trabado para siempre, sin mensaje ni forma de reintentar.
- **Fix**: estado `errorVerificacion` + pantalla de error con botón "Reintentar" (incrementa un
  contador que es dependencia del efecto).

### BUG-43 — `getCurrentOperatorDisplayName` mostraba el correo duplicado
- **Dónde**: `ccp/src/lib/oidc/oidc-client.ts`, `core/frontend/src/lib/oidc/oidc-client.ts`
- **Síntoma**: el nombre del operador se mostraba como `"x@y.com x@y.com"`.
- **Causa raíz**: los usuarios que crea este ecosistema (`crearUsuarioHuman` en `cis`,
  `crearUsuarioDirector` en `sicsaft-core`) mandan `firstName = lastName = email` a Keycloak a
  propósito — Keycloak exige ambos campos no vacíos para dejar loguear (ver Gap 3 en
  `cis/src/keycloak-admin/keycloak-admin.service.ts`). El mapper "full name" de Keycloak arma
  `name` como `"${firstName} ${lastName}"`.
- **Fix**: `preferred_username` primero (un solo valor, el username = el email), luego `name`,
  luego `sub`.

### BUG-44 — `AppShell` de `core/frontend` perdía la sidebar tras el login client-side
- **Dónde**: `core/frontend/src/components/AppShell.tsx`
- **Síntoma**: después del login, la sidebar y "Cerrar sesión" desaparecían aunque el usuario ya
  estuviera logueado (el contenido de la página sí se actualizaba, hace sus propios fetches).
- **Causa raíz**: `AppShell` lee `oidcClient.isAuthenticated()` (valor no reactivo, de
  `localStorage`) durante el render. `AppShell` envuelve `<Routes>` — cuando `AuthCallbackPage`
  navega de `/auth/callback` a `"/"` con `navigate({ replace: true })` (client-side, sin
  recargar), react-router re-renderiza la página de destino pero **no** `AppShell` (sus props no
  cambiaron) → `authenticated` se queda con el `false` del primer render.
- **Fix**: `useLocation()` en `AppShell` — lo suscribe al location del router, se vuelve a
  renderizar en cada navegación y recalcula `isAuthenticated()`. Mismo mecanismo que `ccp`
  ya tenía de casualidad por `useSearchParams()`.

---

## G. Verificación real del wizard contra Keycloak embebido (2026-08-28, post-merge)

Al correr `npm run dev` de punta a punta (`initdb` fresco → Postgres → Keycloak 26 → `core`/`cip`
migrados → wizard completo: cliente → Director → Profesional de AFT) aparecieron dos cosas.

### BUG-45 — La lista blanca de `adminApi()` rompía el bootstrap del realm
- **Dónde**: `sicsaft-core/src/main/keycloak-bootstrap.ts` (`adminApi`)
- **Síntoma**: el paso 1 del wizard (`bootstrapCliente`) fallaba con
  `Ruta de Keycloak Admin API no permitida: "/default-optional-client-scopes/{uuid}"`.
- **Causa raíz**: el commit que cerró `tssecurity:S7044` (ver "Estado", endurecimiento de
  SonarCloud) agregó a `adminApi()` una validación del primer segmento del `path` contra un
  `Set` de segmentos permitidos. Se enumeraron los segmentos de `crearUsuarioDirector` pero
  **no** los de `crearRealmScaffold` — `default-optional-client-scopes` faltaba, y cualquier
  endpoint nuevo de la Admin API rompería igual sin aviso.
- **Fix**: se quita la lista blanca. El armado de URL con `new URL()` contra una base fija (que
  es lo que S7044 pide de verdad: no concatenar `path` crudo en la URL) se mantiene. Enumerar a
  mano cada endpoint de la Admin API que este archivo toca no es sostenible.

### El login embebido carga una IP de LAN muerta horneada en `ccp/dist`
- **No es un bug del código de esta línea** — es el gap "empaquetado final de los portales
  embebidos" (ver "Gaps abiertos"): `ccp/dist` y `core/frontend/dist` que sirve
  `static-portal-server.ts` son builds viejos con `VITE_KEYCLOAK_ISSUER` (y todavía
  `VITE_ZITADEL_*`) apuntando a una IP de LAN de otra red. `PasoListoConLogin` → el portal `ccp`
  redirige a esa IP y da `ERR_CONNECTION_TIMED_OUT`.
- **Qué sí quedó verificado**: `crearUsuarioProfesionalAft` crea el usuario, lo hace miembro de
  la Organization y lo pone en el grupo `{org}::administrador-patrimonial` con el realm role
  mapeado — confirmado consultando la Admin API del Keycloak embebido tras correr el wizard real
  (mismo estándar que la verificación del paso del Director). El paso del Director y
  `resolverOCrearGrupoRol` (role mapping siempre) también verificados igual.

---

## Patrones que se repiten (la parte reusable)

1. **"Verde por fuera, roto por dentro"** — los health-checks de backend en verde no dicen que
   la app funcione. Los bugs BUG-12..BUG-14 estaban todos con los 5 servicios "listos" y la
   ventana en blanco, porque nunca se había mirado la consola del renderer. Regla:
   `npm run dev` abre DevTools solo — mirarlo es el primer paso, no el último. Y verificar contra
   hardware real (BUG-09, BUG-10 aparecieron recién con un Android físico).

2. **`/health/ready` de Keycloak miente** — queda verde antes de estar listo para tráfico real.
   Tres veces distintas: puerto equivocado (BUG-23), token del realm master con 500 en frío
   (BUG-27), realm `sicsaft` no listo para login interactivo (BUG-28). Cualquier llamada nueva a
   Keycloak apenas queda "listo" necesita reintentos cortos solo-ante-5xx.

3. **React StrictMode monta los efectos dos veces** — inofensivo para una suscripción, veneno
   para un efecto que arranca un flujo OIDC, un proceso o una vista nativa. BUG-32, BUG-36,
   BUG-38 son el mismo patrón por tres vías distintas. Todo efecto no idempotente necesita una
   guarda explícita (un ref con el último valor que efectivamente disparó), no solo un cleanup.

4. **`new URL(path, base)` con path absoluto descarta el path de la base** — BUG-09, tres veces
   (`app-qr-sicsaft`, `ccp`, `core/frontend`). El issuer de Keycloak tiene path (`/realms/sicsaft`),
   así que **siempre** path relativo contra el issuer normalizado con `/` final.

5. **Un desktop app real relanza con estado en disco** — todo lo que se generaba "en cada
   arranque" rompía en el segundo: el password de admin (BUG-33), el realm (BUG-30), el arranque
   de `cis` (BUG-31). Lo que persiste en `postgres-data` obliga a persistir (o re-derivar) todo
   lo que lo referencia.

6. **Nombres heredados sin verificar** — `profesional-aft` (BUG-29) se portó de un script viejo
   sin que ningún código real lo usara. Antes de portar una constante, `grep` de quién la
   consume de verdad.

7. **Keycloak Admin API: comportamientos no documentados** — 415 por string body sin
   `Content-Type` (BUG-26), 400 en `/members` en 26.0.x (BUG-25), realm roles globales no
   anidados (BUG-02). Cada llamada nueva a la Admin API se prueba contra un Keycloak real antes
   de escribir el código que la usa, nunca asumida de la documentación (mismo criterio de
   ADR-004 Fase 1).

8. **Una `WebContentsView` nativa no juega con el DOM** — se dibuja fuera del árbol de
   compositing (BUG-40, no hay z-index que la tape) y no se destruye sola al sacarla del árbol
   (BUG-37). Y el placeholder del DOM que la "representa" tiene que ser un nodo estable
   (BUG-39) para que el `ResizeObserver` no lo pierda.

---

## Estado

- **BUG-01 a BUG-25** — corregidos y commiteados en la rama `feat-sicsaft-core-wiring-cis-core-cip`
  (ver el commit citado en cada uno). CI en verde.
- **BUG-26 a BUG-44** — mergeados a `main` en el PR #57 (CORE-RF-04 + endurecimiento de
  OIDC/Keycloak + los 4 fixes de seguridad de SonarCloud del 2026-08-28).
- **BUG-45** (G) — regresión introducida por el fix de S7044 en el PR #57, encontrada
  verificando el wizard real; corregida aparte.

## Gaps abiertos, no bugs

- **"Designar Profesional de AFT" reporta éxito aunque el role mapping falle** (visto en BUG-29):
  del lado de `cis`, `crearGrant()` no propaga el error si el rol no existe en el realm. Con
  BUG-29 corregido el rol siempre existe, pero el gap de reporte silencioso sigue ahí en
  `cis/src/keycloak-admin/` — otro deployable, a revisar aparte. **La versión porteada del gap en
  `sicsaft-core/keycloak-bootstrap.ts` sí quedó cerrada (2026-08-28)** al cablear el paso del
  wizard: `resolverOCrearGrupoRol` ahora hace `GET /roles/{rol}` primero (falla fuerte si no
  existe) y (re)asigna el role mapping siempre, no solo cuando crea el grupo — así un grupo
  reusado de una corrida anterior sin el mapping se repara en vez de otorgar un rol que no está.
- **Automatizar `kc.bat build`** como paso de `electron-builder` (BUG-24) — hoy manual.
- **`extraResources` de `ccp`/`core/frontend`** para el empaquetado final — hoy los sirve
  `static-portal-server.ts` resolviendo el `dist/` hermano en dev; en producción hay que
  copiarlos junto a `cis`/`core`/`cip` (ver `package.json` `"build"`). Además, esos `dist/` traen
  `VITE_KEYCLOAK_ISSUER` (y variables viejas) **horneadas en el bundle** con la IP de LAN de
  cuando se corrió su `npm run build` — el login embebido apunta a una IP muerta si esa red
  cambió (visto en la verificación de G). Hace falta rebuildear los portales con la URL de
  Keycloak de runtime, o inyectarla al servir el `dist/`.

## Documentos relacionados

- [`requirements/INTENT.md`](../requirements/INTENT.md) — por qué se pivoteó a `sicsaft-core.exe`
  (el bug BUG-08 lo disparó).
- [`requirements/REQUIREMENTS.md`](../requirements/REQUIREMENTS.md) — CORE-RF-01..05.
- [`design-artifacts/ARCHITECTURE.md`](ARCHITECTURE.md) — componente por componente, factibilidad
  real y el flujo del login embebido.
- [`sicsaft-core/resources/README.md`](../../../sicsaft-core/resources/README.md) — versiones y
  fuentes exactas de los binarios vendorizados, con el detalle de BUG-23/24/25.
- [ADR-004](../../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md),
  [ADR-005](../../../adr/ADR-005-postgres-pgboss-reemplaza-redis.md).
</content>
</invoke>

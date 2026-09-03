# SICSAFT — entorno local (Docker Compose)

Réplica local de la base de infraestructura del VPS (Traefik + Postgres + Zitadel + CIS + CORE),
para probar todo antes de tocar producción. Ver [`../README.md`](../README.md) para el plan completo
(dominios reales, CI/CD, DevSecOps) y [`../../adr/ADR-002-identidad-zitadel-multi-tenant.md`](../../adr/ADR-002-identidad-zitadel-multi-tenant.md)
para el porqué de Zitadel.

Sin TLS y con dominios `*.sicsaft.localhost` — en producción esos mismos subdominios corren bajo
`sicsaft.cl` con TLS automático vía Traefik + Let's Encrypt (ver `../README.md`).

## Requisitos
- Docker + Docker Compose v2.
- Permisos para editar el archivo hosts del sistema (una sola vez).

## 1. Resolver `*.sicsaft.localhost` a `127.0.0.1`
Windows no resuelve subdominios arbitrarios bajo `.localhost` automáticamente (solo `localhost` a
secas). Agregar al archivo hosts (`C:\Windows\System32\drivers\etc\hosts`, como administrador):

```
127.0.0.1 id.sicsaft.localhost
127.0.0.1 api.sicsaft.localhost
127.0.0.1 traefik.sicsaft.localhost
127.0.0.1 ccp.sicsaft.localhost
127.0.0.1 directivo.sicsaft.localhost
```

(Se agregan más líneas acá a medida que sumemos servicios: `app.`, `qr.`, `cip.`.)

`ccp.sicsaft.localhost` sirve el build de producción de CCP (nginx, ver `ccp/Dockerfile`) cuando
corre dentro del stack (`docker compose up -d --build ccp`) — para desarrollo día a día seguí
usando `npm run dev` (puerto 5174, hot reload), ver `../../ccp/README.md` Desarrollo local.
`directivo.sicsaft.localhost` es el equivalente para `core/frontend/`
(Directivo, DOC-022) — `docker compose up -d --build core-frontend`, o `npm run dev` (puerto
5177) para desarrollo día a día.

## 2. Configurar variables de entorno
```bash
cp .env.example .env
```
Completar contraseñas propias. `ZITADEL_MASTERKEY` debe tener exactamente 32 caracteres —
generarla con `openssl rand -base64 32 | cut -c1-32` (o `openssl rand -hex 16` si no hay acceso a
`cut`). `CORE_SERVICE_TOKEN` (secreto compartido CIS↔CORE, ver `core/README.md`) se genera con
`openssl rand -hex 32` — mismo valor se usa para ambos servicios, el compose ya lo pasa a los
dos. Nunca commitear `.env` (ya cubierto por el `.gitignore` raíz del repo).

## 3. Levantar el stack
```bash
docker compose up -d
docker compose logs -f zitadel   # esperar a que termine el bootstrap (start-from-init)
```

## 4. Verificar
- Dashboard de Traefik: http://traefik.sicsaft.localhost:8080 — confirma que detectó el router de
  Zitadel.
- Zitadel: http://id.sicsaft.localhost — login con `ZITADEL_ADMIN_USERNAME`/`ZITADEL_ADMIN_PASSWORD`
  del `.env`. Desde acá se crea la primera Organización de prueba (ej. "DUOC UC — Melipilla") para
  validar el modelo de ADR-002 antes de que exista ningún cliente real de OIDC (CIS/WEB/APP QR)
  conectado.

## 5. Apagar / limpiar
```bash
docker compose down          # detiene, conserva los volúmenes (datos persisten)
docker compose down -v       # detiene y borra todo — solo para reset completo de datos locales
```

## Nota sobre el ruteo de Traefik en Windows
Este compose usa el **provider `file`** de Traefik (`traefik/dynamic.yml`, ruteo estático por
nombre de servicio Docker) en vez del provider `docker` (descubrimiento automático por labels).
Se probó primero con `docker` montando `/var/run/docker.sock` y falló con
`Error response from daemon: ""` (respuesta vacía) — Docker Desktop en Windows bloquea por
defecto que un contenedor lea el socket del daemon (Enhanced Container Isolation). En el VPS real
(Linux) esa restricción no existe, así que producción puede volver a discovery por labels si
conviene tener menos archivos que mantener a mano a medida que se agreguen más servicios — queda
como decisión abierta en `../README.md`.

## Observabilidad (Prometheus + Loki + Grafana, self-hosted)

Equivalente self-hosted a CloudWatch/CloudTrail — corre dentro del mismo `docker compose`, sin
depender de ningún servicio en la nube, para que el operador del VPS lo administre directamente.
Config versionada en `observability/` (`prometheus.yml`, `loki-config.yml`,
`promtail-config.yml`, `grafana/provisioning/`).

**Componentes:**
- **node-exporter** — métricas del host (CPU/memoria/disco/red), lo mismo que CloudWatch da gratis
  por instancia EC2.
- **cAdvisor** — métricas por contenedor (CPU/memoria/red/IO por servicio), equivalente a
  CloudWatch Container Insights.
- **Prometheus** — scrapea a los dos de arriba (`observability/prometheus.yml`, targets estáticos —
  mismo criterio que Traefik arriba: sin discovery por socket de Docker).
- **Promtail** — envía los logs de TODOS los contenedores del stack a Loki, sin tocar código de
  aplicación (`docker_sd_configs` contra el socket de Docker — a diferencia de Traefik, esto SÍ
  funciona bajo Enhanced Container Isolation; verificado real, con un filtro explícito para no
  mezclar logs de otros proyectos Docker de la misma máquina).
- **Loki** — almacena los logs (filesystem local, retención 7 días en este stack de desarrollo).
- **Grafana** — dashboards. Datasources (Prometheus + Loki) y un dashboard inicial
  ("SICSAFT — Overview") se provisionan solos al arrancar, sin configurar nada a mano.

**Acceso:** http://grafana.sicsaft.localhost — usuario/contraseña de `GRAFANA_ADMIN_USER`/
`GRAFANA_ADMIN_PASSWORD` (`.env`). El dashboard "SICSAFT — Overview" (carpeta "SICSAFT") trae:
CPU/memoria de host, CPU/memoria por contenedor, volumen de logs por servicio, y un panel de
últimos logs de todos los servicios.

**Limitación conocida en Docker Desktop (Windows/Mac), no en el VPS real**: cAdvisor no puede leer
las métricas por-contenedor individuales bajo Docker Desktop —
`failed to identify the read-write layer ID for container ...` en sus logs — porque Docker
Desktop expone el storage driver de forma distinta dentro de su VM que un Docker nativo de Linux.
Las métricas de **host** (node-exporter) y los **logs** (Loki/Promtail) sí funcionan
completos y verificados acá; las métricas **por contenedor** de cAdvisor van a andar sin cambios
de config en el VPS real (Linux nativo), que es el entorno para el que está pensado este stack.

**Para ir más allá** (no incluido en este incremento): los backends NestJS (`cis/`, `core/`) no
exponen `/metrics` propio todavía — el `prometheus.yml` deja el target comentado y listo para
cuando se agregue `prom-client`/`@willsoto/nestjs-prometheus`. Dashboards de la comunidad
("Node Exporter Full", id `1860` en grafana.com) se pueden importar desde la propia UI de Grafana
(Dashboards → New → Import → pegar el id) sin necesidad de versionarlos acá.

## Pruebas de carga (k6)

Prueba rápida de carga/estrés contra `cis`/`core`/`cip`, visualizada en el Grafana de arriba —
ver [`k6/README.md`](k6/README.md) para cómo correrla y qué mide cada script. No es el
entregable formal de `ROADMAP.md` Fase 5/OPS-5 (ese corre en cron contra staging); esto es una
pasada rápida contra el stack local mientras se desarrolla.

## Cliente OIDC real (ROADMAP.md Fase 0) — ya hecho, pasos para reproducirlo
1. Levantar el stack y entrar a `http://id.sicsaft.localhost`, login con
   `ZITADEL_ADMIN_USERNAME`/`ZITADEL_ADMIN_PASSWORD` (Zitadel obliga a cambiar la contraseña en
   el primer login — actualizar `.env` con la nueva).
2. Crear una Organización de prueba ("DUOC UC") — valida el modelo de
   [ADR-002](../../adr/ADR-002-identidad-zitadel-multi-tenant.md).
3. Dentro de la organización: crear un Proyecto ("CIS") y una Aplicación OIDC tipo **User Agent**
   (SPA/PWA, PKCE, sin secreto) para el futuro cliente real de APP QR — nombre `app-qr-sicsaft`,
   redirect URI de desarrollo `http://localhost:5173/auth/callback` (puerto de Vite, con
   "Development Mode" activado para permitir `http://`).
4. **Cambiar el tipo de token de la app a JWT** (Token Settings → Auth Token Type → `JWT`, no
   `Bearer Token`/opaco) — `ZitadelAuthGuard` valida firma vía JWKS con `jose`, un token opaco no
   sirve. Esto no es obvio en la UI (el default es opaco) y solo se descubre probando el flujo
   completo, no leyendo la documentación de Zitadel.
5. Copiar el **Resource ID del proyecto** (no el Client ID de la app) a `CIS_ZITADEL_AUDIENCE` en
   `.env` — el `aud` del JWT incluye ambos (`[clientId, projectId]`), y el Resource ID es estable
   aunque se agreguen más apps al mismo proyecto (WEB más adelante, por ejemplo).
6. `docker compose up -d --build cis` para que tome la variable nueva.
7. **Habilitar `offline_access`** en la app `app-qr-sicsaft` (Token Settings → Auth Token Type ya
   en `JWT` del paso 4; agregar el scope/grant `offline_access` para que Zitadel emita
   `refresh_token`) — TASK-007 usa refresh token explícito, no re-login silencioso (decisión
   confirmada con el usuario, ver `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md` 5). Sin esto,
   `oidc-client.ts` falla fuerte al canjear el primer `code` con un mensaje explícito en vez de
   degradar a un comportamiento no pedido.
8. Copiar el **Client ID** de la app `app-qr-sicsaft` a `app-qr-sicsaft/.env`
   (`VITE_ZITADEL_CLIENT_ID`, ver `app-qr-sicsaft/.env.example`) junto con
   `VITE_ZITADEL_ISSUER=http://id.sicsaft.localhost` y `VITE_CIS_URL=http://api.sicsaft.localhost`
   — CIS ya expone `CIS_CORS_ORIGIN=http://localhost:5173` en `docker-compose.yml` (puerto de
   Vite dev) para aceptar estas requests desde el navegador.

Verificado real de punta a punta (no solo con mocks): login de un usuario real en el dashboard de
Zitadel → authorization code + PKCE real (`GET /oauth/v2/authorize` con `code_challenge`) →
canje del código por un JWT real (`POST /oauth/v2/token`) → `POST /auth/session` en CIS con ese
JWT como `Authorization: Bearer` → CIS valida firma/`iss`/`aud` y llama a `GET /entitlements` en
CORE → CORE responde con datos reales de Postgres. HTTP 201, no 401.

**Bug real encontrado y corregido en el camino** (no solo documentado, corregido): Zitadel es
multi-tenant por dominio y rechaza cualquier request cuyo header `Host` no sea uno de sus
dominios registrados — pedirle el JWKS por el nombre de servicio interno de Docker
(`http://zitadel:8080/...`, lo que decía el comentario original de `docker-compose.yml`) falla
con `Instance not found`, verificado real, no en teoría. Node's `fetch` tampoco deja forzar un
header `Host` distinto al de la URL (lo ignora). Fix: el servicio `traefik` de este compose ahora
tiene un alias de red `id.sicsaft.localhost` (ver `docker-compose.yml`) — `cis` le pega a
Zitadel por el mismo dominio externo tanto adentro como afuera de la red Docker, sin URLs
internas especiales. `ZITADEL_JWKS_URI` ya no hace falta como variable separada: se deriva de
`ZITADEL_ISSUER` (ver `loadZitadelAuthConfig`).

**Actualización (Fase 3, TASK-007)**: `app-qr-sicsaft/src/lib/oidc/` ya implementa este mismo
flujo real desde la UI (antes solo se había probado con `curl` simulando el cliente) —
`app-qr-sicsaft/src/lib/qr-connector.ts` dejó de ser un stub. Verificado real de punta a punta el
2026-08-13 (login de usuario real → catálogo → escaneo → envío → persistencia confirmada en
Postgres, ver `ROADMAP.md` Fase 3).

## Cliente OIDC real (WEB) — Fase 5, ROADMAP.md

Mismo proyecto "CIS" y misma organización "DUOC UC" que usa `app-qr-sicsaft` — no se crea un
proyecto nuevo. Pasos reales seguidos (2026-08-14), reproducibles desde el dashboard
(`http://id.sicsaft.localhost`):

1. Dentro del proyecto "CIS" → **Roles** → crear un rol de Proyecto `administrador-patrimonial`
   (DOC-012 2). Sin esto, `verificarRolAdministradorPatrimonial` en CORE siempre rechaza —
   Zitadel no tiene qué rol firmar.
2. Proyecto "CIS" → **General** → activar **"Assert Roles on Authentication"**. Sin esto, el claim
   `urn:zitadel:iam:org:project:roles` nunca aparece en el token aunque el usuario tenga el rol
   asignado (alternativa: pedir el scope reservado
   `urn:zitadel:iam:org:project:role:administrador-patrimonial` desde el cliente en vez de esta
   opción a nivel de proyecto).
3. Crear un usuario de prueba en la organización "DUOC UC" (Users → New) con **"Email Verified"**
   y **"Set Initial Password"** marcados al crearlo — un usuario creado sin esas dos opciones
   queda en estado "Initial" esperando un email de activación que nunca llega (sin SMTP
   configurado en local) y no se le puede fijar contraseña hasta inicializarlo; más simple
   recrearlo con ambas casillas marcadas que resolver el flujo de init code a mano.
4. Ese usuario → **Authorizations** → New → proyecto "CIS" → rol `administrador-patrimonial`.
5. Proyecto "CIS" → **Applications** → New → tipo **User Agent** (SPA, PKCE) → nombre
   `web-sicsaft` → **Development Mode** habilitado (redirect URI `http://` en dev) → redirect URI
   `http://localhost:5174/auth/callback` (puerto de Vite de `ccp/`, no 5173 — ese es
   `app-qr-sicsaft`).

   ⚠️ **Redirect URIs — la app necesita las DOS**, no solo la de Vite: `redirect_uri` lo calcula
   cada frontend como `${window.location.origin}/auth/callback` (ver `ccp/src/lib/oidc/oidc-config.ts`),
   así que cambia según cómo lo estés probando — `http://localhost:5174/auth/callback` corriendo
   `npm run dev`, **`http://ccp.sicsaft.localhost/auth/callback` corriendo el stack de Docker**
   detrás de Traefik (mismo criterio para `postLogoutRedirectUris` y `allowedOrigins`). Si falta
   cualquiera de las dos, el login tira `invalid_request: The requested redirect_uri is missing in
   the client configuration` — ya pasó una vez: la app quedó con `web.sicsaft.localhost` (el
   hostname de antes del rename `web/` → `ccp/` de DOC-022) en vez de `ccp.sicsaft.localhost`, y
   Traefik ya no enruta ese hostname viejo a ningún lado. Se corrigió vía la Management API de
   Zitadel (`PUT /management/v1/projects/{id}/apps/{id}/oidc_config` con el
   `ZITADEL_ADMIN_TOKEN` de `devops/local/.env`) en vez de la Console — mismo resultado.
6. En **Token Settings** de esa aplicación: **Auth Token Type = JWT** (no Bearer/opaco, mismo
   motivo que `app-qr-sicsaft`), **Access Token Role Assertion** y **ID Token Role Assertion**
   habilitados (el rol tiene que llegar en el token, no solo en `/userinfo`), y grant type
   `refresh_token` agregado (mismo criterio de refresh explícito que `app-qr-sicsaft`, no
   re-login silencioso).
7. Copiar el **Client ID** de `web-sicsaft` a `ccp/.env` (`VITE_ZITADEL_CLIENT_ID`, ver
   `ccp/.env.example`) junto con `VITE_ZITADEL_ISSUER=http://id.sicsaft.localhost` y
   `VITE_CIS_URL=http://api.sicsaft.localhost`.
8. `CIS_CORS_ORIGIN` en `docker-compose.yml` (servicio `cis`) debe incluir
   `http://localhost:5174` además de `http://localhost:5173` — ya seteado.
9. `ZITADEL_ORG_ID_MAP` en `docker-compose.yml` (servicio `cis`) — mapea el id de organización de
   Zitadel (el que aparece en la URL del dashboard al entrar a "DUOC UC", ej.
   `386029528616558597`) al `organizacionId` de texto que CORE realmente usa (`duoc-uc`). Sin este
   mapeo, `AdministradorService` (`cis/src/administrador/`) no puede traducir el claim de rol que
   Zitadel firma (keyed por SU id de organización) al id que `verificarRolAdministradorPatrimonial`
   de CORE espera — ver `cis/README.md` Fase 5.

Los pasos 1-4 se hicieron una sola vez vía la API REST de gestión de Zitadel
(`/management/v1/...`, con el access token de una sesión de administrador ya autenticada en el
dashboard) cuando la UI del wizard de creación de aplicaciones no exponía directamente el
`accessTokenRoleAssertion` — el resultado final es idéntico a hacerlo a mano desde Console.

**Verificado real de punta a punta el 2026-08-14**: login de `admin-patrimonial@sicsaft.localhost`
desde `ccp/` (authorization code + PKCE real) → JWT con el claim de rol → `POST /admin/activos`
en CIS → CORE crea el activo en Postgres → visible en `GET /catalogo`. Ver `cis/README.md` y
`core/README.md` Fase 4/5 para el detalle de cada lado.

## Rol `directivo` (WEB) — DOC-020, segmentación por rol [SUPERADO por DOC-022]

⚠️ Esta sección documenta el mecanismo original de DOC-020 (2026-08-18), donde el Directivo
entraba a `ccp/` y era redirigido a `/dashboard`. **DOC-022 (2026-08-19) lo reemplaza**: el
Directivo ya no entra a `ccp/` en absoluto, tiene su propio portal (`core/frontend/`) — ver
"Cliente OIDC real (core/frontend)" y "Rol `directivo` + gestión de roles (core/frontend)" más
abajo. Se deja este historial porque el rol de Proyecto `directivo` creado acá sigue siendo el
mismo (no se recrea), solo cambia qué aplicación OIDC lo consume.

Mismo proyecto/aplicación `web-sicsaft` de arriba, sin infraestructura nueva — solo un rol de
Proyecto adicional (`ZitadelAuthGuard.extractRolesPorOrganizacion` ya lo parsea de forma genérica,
sin cambios de código en CIS, ver DOC-020 3):

1. Proyecto "CIS" → **Roles** → crear un rol de Proyecto `directivo` (mismo mecanismo que
   `administrador-patrimonial` arriba, "Assert Roles on Authentication" ya está habilitado a nivel
   de proyecto desde ese incremento — no hace falta repetir el paso 2).
2. Crear (o reusar) un usuario de prueba en "DUOC UC" **sin** el rol `administrador-patrimonial` —
   el caso mixto (DOC-020 5) muestra el hub operativo completo, así que para ver el redirect
   directo al Dashboard hace falta un usuario que sea *solo* Directivo.
3. Ese usuario → **Authorizations** → New → proyecto "CIS" → rol `directivo`.
4. Login desde `ccp/` con ese usuario → debería aterrizar directo en `/dashboard?organizacionId=...`
   sin pasar por el hub de tarjetas.

**Verificado real de punta a punta el 2026-08-18** con tres usuarios de prueba en "DUOC UC"
(`directivo-test@sicsaft.localhost`, `mixto-test@sicsaft.localhost` con ambos roles, y el
`admin-patrimonial@sicsaft.localhost` ya existente) — confirma los 3 casos de DOC-020 5, ver la
tabla en el encabezado de [DOC-020](../../aidlc-docs/ccp/design-artifacts/DOC-020-segmentacion-por-rol-directivo.md).
Nota: si `ccp` corría desde antes de este incremento, hace falta `docker compose build ccp` — la
imagen no se reconstruye sola al mergear código nuevo.

## Cliente OIDC real (core/frontend) — DOC-022 4

`core/frontend/` (portal del Directivo) necesita su propia Application OIDC — mismo proyecto "CIS"
y misma organización "DUOC UC", mismo patrón que `ccp` arriba:

1. Proyecto "CIS" → **Applications** → New → tipo **User Agent** (SPA, PKCE) → nombre
   `core-frontend-sicsaft` → **Development Mode** habilitado → redirect URI
   `http://localhost:5177/auth/callback` (puerto de Vite de `core/frontend/`) **y también**
   `http://directivo.sicsaft.localhost/auth/callback` si se va a probar corriendo el stack de
   Docker detrás de Traefik, no solo `npm run dev` — ver la nota ⚠️ en "Cliente OIDC real (WEB) —
   Fase 5" arriba para el porqué (mismo criterio para `postLogoutRedirectUris`/`allowedOrigins`).
2. En **Token Settings**: **Auth Token Type = JWT**, **Access Token Role Assertion** e **ID Token
   Role Assertion** habilitados, grant type `refresh_token` agregado.
3. Copiar el **Client ID** a `core/frontend/.env` (`VITE_ZITADEL_CLIENT_ID`) y a
   `devops/local/.env` (`CORE_FRONTEND_VITE_ZITADEL_CLIENT_ID`, para cuando corre dentro del
   stack).
4. `CIS_CORS_ORIGIN` en `docker-compose.yml` (servicio `cis`) debe incluir
   `http://localhost:5177` y `http://directivo.sicsaft.localhost` — ya seteado.
5. Usuario de prueba en "DUOC UC" con el rol `directivo` (el mismo rol de Proyecto ya creado para
   DOC-020, ver arriba — no se recrea) → login desde `core/frontend/` → resuelve la organización
   vía `POST /auth/session` y aterriza en `/dashboard?organizacionId=...`.

**Verificado real de punta a punta el 2026-08-19**: Application OIDC `core-frontend-sicsaft`
creada, login real con `directivo-test`, Dashboard con datos reales, designación de Profesional de
AFT confirmada (dos casos: usuario sin grant previo, y usuario con otro rol ya asignado — este
último destapó y corrigió dos bugs reales en `cis/src/keycloak-admin/`, ver `cis/README.md`).

## Rol `directivo` + gestión de roles (core/frontend) — DOC-022 3

El rol de Proyecto `directivo` ya existe (creado para DOC-020, ver arriba) — este incremento le
suma una capacidad de **escritura** nueva: designar quién es el Profesional de AFT
(`administrador-patrimonial`) de su propia organización, vía `cis/src/directivo/`
(`GET/POST /directivo/usuarios`). Reusa el mismo `ZitadelAdminService` y el mismo service user con
Personal Access Token del service user (ver más abajo) — sin infraestructura nueva de ese lado.

1. Usuario de prueba en "DUOC UC" con el rol `directivo` → **Profesional de AFT** en
   `core/frontend/` → designar un email de un usuario ya existente en Zitadel.
2. Verificar el límite de organización: un segundo Directivo de prueba en una organización
   distinta (crear una organización nueva vía la Console de Zitadel primero) no debería poder
   ver ni tocar los usuarios de "DUOC UC" — `DirectivoGuard` en CIS deriva la organización siempre
   del propio JWT, nunca de un parámetro que el cliente pueda mandar.

⚠️ Pendiente verificación real de punta a punta (mismo estado que la sección anterior).

## Service user + Personal Access Token para la Admin API de Zitadel

CIS necesita este service user para la integración real de identidad (hoy: el portal Directivo
designa al Profesional de AFT de su organización, `cis/src/keycloak-admin/` en el stack de
Keycloak, `cis/src/zitadel-admin/` cuando el stack todavía corre Zitadel).

A diferencia del resto de la integración con Zitadel de este repo (login de operadores vía
OIDC/PKCE), esto es autenticación **service-to-service** de CIS hacia la API de administración de
Zitadel (`/management/v1/...`) — necesita su propio usuario técnico, no reusa ninguna app OIDC
existente.

1. Organización (la misma donde vive el proyecto "CIS", normalmente la organización raíz) →
   **Users** → **New** → **Service User** (no "Human User") — nombre sugerido
   `sicsaft-admin-service`.
2. Asignarle un rol de **IAM/Org Manager** (Console → Users → el service user → **Authorizations**
   → rol a nivel de Organización que le permita listar/crear grants de usuarios en cualquier
   organización — no un rol de Proyecto como los de arriba, es un rol de administración de
   Zitadel mismo).
3. Ese service user → **Personal Access Tokens** → **New** → sin fecha de expiración (o una fecha
   larga, según política) → copiar el token, empieza con algo como `pat_...` — **se muestra una
   sola vez**.
4. `devops/local/.env`: completar `ZITADEL_ADMIN_TOKEN` con ese token y `ZITADEL_PROJECT_ID` con
   el Resource Id del proyecto "CIS" (Console → proyecto "CIS" → General → "Resource Id", mismo
   id que ya se usa como `CIS_ZITADEL_AUDIENCE`/`ZITADEL_AUDIENCE` en otros pasos de este mismo
   documento).
5. `docker compose up -d --build cis` — `ZitadelAdminModule` exige esta config al arrancar
   (`loadZitadelAdminConfig`), igual criterio que el resto de módulos de config obligatoria de
   este stack.

**Nota de honestidad**: los shapes de la API de Zitadel que usa `cis/src/zitadel-admin/` están
armados contra su documentación pública, sin verificar todavía contra una instancia real (ver
`cis/src/zitadel-admin/zitadel-admin.types.ts`) — verificar los 3 endpoints
(`POST /management/v1/users/_search`, `POST /management/v1/users/grants/_search`,
`POST /management/v1/users/{id}/grants`) contra el Zitadel real de este stack antes de confiar en
producción, y ajustar el parseo si la forma real difiere.

## Otros puntos ya resueltos
- **`core` ya está en el compose** (esqueleto NestJS, `GET /`/`GET /health` + `GET /entitlements`
  real ya consumido por `cis`, sin router de Traefik a propósito — solo lo consume `cis` dentro
  de la red, ver `core/README.md`). Protegido con `CORE_SERVICE_TOKEN` (auth
  servicio-a-servicio) — sin ese secreto en `.env`, ni `cis` ni `core` arrancan.
- **`GET /entitlements` ya lee de Postgres real**, no de un seed en memoria: el servicio
  `postgres` de este compose crea una base `core` dedicada y vacía (`init/02-core.sh`); el
  esquema (mismo modelo de `base-patrimonial/DOC-004-modelo-contrato.md`) lo aplica el servicio
  `core-migrate` corriendo las migraciones de `core/migrations/` una sola vez, antes de levantar
  `core` (`depends_on: service_completed_successfully`) — con el caso DUOC UC/Melipilla
  precargado por la migración de seed. `CORE_DB_USER`/`CORE_DB_PASSWORD` en `.env` — sin ellos,
  ni `core-migrate` ni `core` arrancan (ver `core/src/database/database.config.ts`).
- Este compose es la base compartida; WEB se agrega acá como servicio nuevo cuando tenga
  Dockerfile — no antes, para no mantener contenedores vacíos.

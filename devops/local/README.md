# SICSAFT — entorno local (Docker Compose)

Réplica local de la base de infraestructura del VPS (Traefik + Postgres + Redis + Zitadel + CIS +
CORE), para probar todo antes de tocar producción. Ver [`../README.md`](../README.md) para el plan completo
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
```

(Se agregan más líneas acá a medida que sumemos servicios: `app.`, `qr.`, `cip.`.)

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

Sigue sin existir un cliente real dentro de `app-qr-sicsaft/` que haga este mismo flujo desde la
UI (hoy se probó con `curl` simulando el cliente) — eso es TASK-006/007 de APP QR, deliberadamente
fuera de alcance de la Fase 0 (ver `app-qr-sicsaft/src/lib/qr-connector.ts`, que documenta por
qué sigue siendo un stub hasta esa tarea).

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

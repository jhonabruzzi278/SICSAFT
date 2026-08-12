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

## Qué falta antes de que esto sea útil de punta a punta
- **Crear la aplicación OIDC del CIS en Zitadel** (el CIS ya valida tokens reales contra Zitadel,
  ver `cis/README.md` § Conector QR — falta crear la app en el dashboard, no código):
  1. Levantar el stack y entrar a `http://id.sicsaft.localhost`, login con
     `ZITADEL_ADMIN_USERNAME`/`ZITADEL_ADMIN_PASSWORD`.
  2. Crear una Organización de prueba (ej. "DUOC UC") si no existe — valida el modelo de
     [ADR-002](../../adr/ADR-002-identidad-zitadel-multi-tenant.md).
  3. Crear un Proyecto y una Aplicación API (u OIDC) dentro — copiar el Client ID (o el Resource
     ID del proyecto) a `CIS_ZITADEL_AUDIENCE` en `.env`.
  4. `docker compose up -d --build cis` para que tome la variable nueva.
  - Sigue sin existir un cliente real (WEB/APP QR) que haga el flujo de login completo
    (authorization code + PKCE) y le pase el token al CIS — eso es TASK-006/007 de APP QR.
- **`core` ya está en el compose** (esqueleto NestJS, `GET /`/`GET /health` + `GET /entitlements`
  real ya consumido por `cis`, sin router de Traefik a propósito — solo lo consume `cis` dentro
  de la red, ver `core/README.md`). Protegido con `CORE_SERVICE_TOKEN` (auth
  servicio-a-servicio) — sin ese secreto en `.env`, ni `cis` ni `core` arrancan.
- Este compose es la base compartida; WEB se agrega acá como servicio nuevo cuando tenga
  Dockerfile — no antes, para no mantener contenedores vacíos.

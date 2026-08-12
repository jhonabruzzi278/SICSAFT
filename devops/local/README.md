# SICSAFT — entorno local (Docker Compose)

Réplica local de la base de infraestructura del VPS (Traefik + Postgres + Redis + Zitadel), para
probar todo antes de tocar producción. Ver [`../README.md`](../README.md) para el plan completo
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
127.0.0.1 traefik.sicsaft.localhost
```

(Se agregan más líneas acá a medida que sumemos servicios: `api.`, `app.`, `qr.`, `cip.`.)

## 2. Configurar variables de entorno
```bash
cp .env.example .env
```
Completar contraseñas propias. `ZITADEL_MASTERKEY` debe tener exactamente 32 caracteres —
generarla con `openssl rand -base64 32 | cut -c1-32` (o `openssl rand -hex 16` si no hay acceso a
`cut`). Nunca commitear `.env` (ya cubierto por el `.gitignore` raíz del repo).

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
- Configurar en Zitadel una aplicación OIDC de prueba y un cliente que la consuma (todavía no hay
  código de CIS/WEB/APP QR contra el que probar el login real) — próximo paso una vez exista un
  esqueleto de CIS en NestJS (ver [ADR-001](../../adr/ADR-001-stack-backend-nestjs.md)).
- Este compose es la base compartida; CIS/CORE/WEB se agregan acá como servicios nuevos a medida
  que tengan Dockerfile — no antes, para no mantener contenedores vacíos.

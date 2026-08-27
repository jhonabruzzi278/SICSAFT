# SICSAFT CORE — app de escritorio nativa — Metadata del proyecto

**Fase AI-DLC:** Inception

**Sistema:** `sicsaft-core/` (nuevo — app de escritorio Electron, reemplaza a `devops/onprem/`
como camino principal de instalación por cliente, ver `INTENT.md` CORE-Q-02)

**Incremento:** Nivel 1 embebido en un único instalador `.exe` (Postgres/Keycloak/CIS/CORE/CIP como
procesos nativos, sin contenedores — sin Redis, ver ADR-005) + wizard de primer arranque (alta del
Director, alta del Profesional de AFT).

## Quick links

- Intención: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requisitos: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Implementación: `sicsaft-core/` (carpeta de código, a crear en la raíz del monorepo)

## Estado

🟢 Nivel 1 completo arrancando de verdad (2026-08-27) — Postgres/Keycloak/`cis`/`core`/`cip`
embebidos, verificado real (binarios reales, no solo compilado): typecheck/lint/build/test en
verde. Ver `sicsaft-core/README.md` para el detalle completo.

**Corrección real sobre `CORE-Q-01` (mismo día, después de haberla dado por resuelta)**: no existe
ninguna APK Android ya construida — la afirmación "wrap Capacitor de `app-qr-sicsaft/` ya
compilado fuera del repo" era incorrecta, el usuario la corrigió. `CORE-Q-01` queda **reabierta**
en `requirements/INTENT.md`: construir la APK (o decidir cómo/cuándo) es un incremento aparte, no
resuelto ni bloqueante para este. `CORE-Q-02` (convivencia con `devops/onprem/`) sigue resuelta sin
cambios.

**Redis sacado del ecosistema completo (ADR-005, mismo día)**: el usuario confirmó eliminar Redis
de los 3 perfiles de `devops/`, no solo del embebido — `core/`+`cip/` mueven la cola `cip-eventos`
a `pg-boss` sobre Postgres, `cis/` mueve rate-limiter/device-registry a memoria del propio proceso.
Implementado y verificado real (tests/build/lint en verde en los 3 sistemas + los 3
`docker-compose.yml` + los 2 workflows de CI que tenían Redis). Ver "Redis — resuelto" en
`ARCHITECTURE.md`.

**Binarios vendorizados y los 5 servicios arrancando de punta a punta (mismo día)**: PostgreSQL
16.15-1, Keycloak 26.0.8 + JRE Temurin 17.0.20.1+1 descargados de sus fuentes oficiales y
verificados reales (`initdb`/`postgres.exe`/consulta SQL real; `kc.bat build`+`start --optimized`
con `/health/ready` respondiendo real; `core`/`cip` migrados y respondiendo `/health` real) — ver
`sicsaft-core/resources/README.md` para 3 hallazgos reales encontrados en el camino (el
health-check de Keycloak 26 vive en un puerto de management separado del HTTP principal;
`--db`/`--health-enabled` son opciones de build time, no runtime; Keycloak 26.0.0 tiene un bug real
en el alta de miembros de una Organization, arreglado en 26.0.6 — de ahí vendorizar 26.0.8, no
26.0.0). Más 3 hallazgos reales de wiring encontrados corriendo `npm run dev` por primera vez
(rutas relativas con un `../` de más en los 3 servicios embebidos; `spawn()` de Windows no puede
ejecutar `.bat` sin `shell:true`; `node-pg-migrate` resuelve `dir: 'migrations'` contra el `cwd`
del proceso hijo, no contra dónde vive el script). `service-orchestrator.ts` ya arranca Postgres →
bootstrap de las 4 bases → Keycloak → migra y arranca `core` → migra y arranca `cip`, y `cis`
arranca aparte una vez que el wizard genera sus credenciales. `crearUsuarioDirector` (port
recortado de `KeycloakAdminService.crearUsuarioHuman`/`crearGrant`) implementa el alta real del
Director con el rol `directivo` — verificado real de punta a punta contra un Keycloak vivo,
incluyendo confirmar contra la Admin API que el usuario quedó en el grupo/rol correcto y con
`UPDATE_PASSWORD` forzado.

## Depende de

`cis/`, `core/`, `cip/`, `web_admin/`, `core/frontend/` (código de aplicación reusado tal cual,
sin cambios) — y de todo el trabajo de identidad de ADR-004 Fases 1-3 (`KeycloakAdminService`,
`KeycloakAuthGuard`, el modelo de roles por Organization) y de ADR-005 (`pg-boss`,
`InMemoryRateLimiter`), que se reusan sin reescribir.

## Bloquea

Nada de forma dura — `devops/onprem/` (Podman) sigue existiendo en paralelo de forma permanente
(CORE-Q-02 resuelta: coexisten, no se reemplaza).

## Próximo paso sugerido

1. Cablear el paso "Profesional de AFT" del wizard al endpoint real de `cis/`
   (`PasoProfesionalAft.tsx` + nuevo handler IPC, mismo patrón que `altaDirector`) — `cis/` ya
   corre embebido, solo falta este último handler.
2. Empaquetado real (`electron-builder`, `npm run dist:win`): configurar `extraResources` para
   copiar `dist/`+`node_modules/`+`migrations/`+`scripts/` de `cis`/`core`/`cip` a
   `resources/<sistema>/`, y automatizar el paso `kc.bat build --db=postgres --health-enabled=true`
   (hoy manual, ver `resources/README.md`).
3. Decidir cuándo/cómo se construye la APK Android (`CORE-Q-01`, reabierta — no existe todavía) —
   incremento aparte, no bloqueante para lo de arriba.
4. CORE-Q-03 (Nivel 2/3 en `sicsaft-core.exe`) sigue sin resolverse, fuera de alcance por ahora.

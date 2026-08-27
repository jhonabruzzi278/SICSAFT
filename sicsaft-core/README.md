# SICSAFT CORE — app de escritorio nativa

## Objetivo

Instalador `.exe` único que empaqueta todos los beneficios de Nivel 1 (Postgres, Keycloak, `cis/`,
`core/`, `cip/` — sin Redis, ver ADR-005) como procesos nativos embebidos en una app Electron — sin
Podman, sin Docker, sin WSL2, sin navegador visible para el cliente. Es el camino **prioritario** de
instalación por cliente; `devops/onprem/` (Podman) se mantiene como alternativa para un perfil de
cliente con servidor dedicado — confirmado con el usuario 2026-08-27, ver
[`aidlc-docs/sicsaft-core/requirements/INTENT.md`](../aidlc-docs/sicsaft-core/requirements/INTENT.md)
CORE-Q-02.

La APK de Android que se instala junto a esta app es un wrap de `app-qr-sicsaft/` hecho con
Capacitor, ya construido fuera de este repo (CORE-Q-01, mismo documento).

## Estado

🟢 Los 5 servicios de Nivel 1 (Postgres, Keycloak, `cis`, `core`, `cip`) arrancan de verdad,
verificado real (2026-08-27) — no solo compilado. `npm run typecheck`/`lint:ci`/`build`/`test` en
verde:

- Estructura Electron completa (`electron-vite`: main/preload/renderer) con contextIsolation +
  sandbox — el renderer nunca tiene acceso directo a Node/secretos, todo pasa por IPC tipado
  (`src/shared/ipc-contract.ts`).
- `ManagedProcess` (`src/main/services/managed-process.ts`) — wrapper genérico de spawn/health-
  check/shutdown limpio, reusado por los 5 servicios embebidos (ADR-005 sacó a Redis, un servicio
  menos). Con tests reales.
- **Binarios vendorizados y verificados end-to-end**: PostgreSQL 16.15-1, Keycloak 26.0.8 + JRE
  Temurin 17.0.20.1+1 en `resources/` (ver `resources/README.md` para versiones/fuentes exactas y
  3 hallazgos reales encontrados arrancándolos de verdad: el health-check de Keycloak 26 vive en
  un puerto de management separado; `--db`/`--health-enabled` son opciones de build time, no de
  runtime; Keycloak 26.0.0 tiene un bug real en el alta de miembros de una Organization, arreglado
  en 26.0.6 — de ahí vendorizar 26.0.8).
- `postgres-bootstrap.ts` crea las 4 bases (`keycloak`/`core`/`cip`/`eventos_outbox`) bajo un
  único usuario admin — simplificación deliberada frente al modelo multi-usuario de `devops/`
  (documentada, no un descuido: acá el único cliente de Postgres es esta misma app).
- `service-orchestrator.ts` arranca Postgres → bootstrap de bases → Keycloak → migra y arranca
  `core` → migra y arranca `cip`; `cis` arranca aparte (`iniciarCis()`) una vez que el wizard crea
  sus credenciales de Keycloak.
- `keycloak-bootstrap.ts` — port a TypeScript de `devops/onprem/lib/Bootstrap-Keycloak.psm1`
  (realm, scopes, roles, Organization, clients OIDC) + `crearUsuarioDirector` (port recortado de
  `KeycloakAdminService.crearUsuarioHuman`/`crearGrant`), mismas llamadas a la Admin REST API ya
  verificadas reales en ADR-004 Fase 3.
- Wizard de primer arranque (datos del cliente → alta del Director → alta del Profesional de AFT)
  — UI completa, con los 2 primeros pasos ya llamando IPC real de punta a punta.

**Lo que NO está resuelto todavía** (ver
[`aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md`](../aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md)
para el detalle real de cada uno, sin minimizar):

- **Paso "Profesional de AFT" del wizard**: `cis/` ya corre embebido, pero este último paso
  todavía no tiene el handler IPC que llame a su endpoint real (`PasoProfesionalAft.tsx` sigue
  siendo un placeholder honesto).
- **Empaquetado `electron-builder`** (`dist:win`): en `npm run dev` no hace falta (los binarios se
  resuelven directo desde `resources/`/el monorepo), pero el instalador final necesita copiar
  `dist/`+`node_modules/`+`migrations/`+`scripts/` de `cis`/`core`/`cip` a `resources/<sistema>/`,
  y automatizar el paso de `kc.bat build` — pendiente.
- **La APK Android no existe todavía** — a diferencia de lo que se pensó en un momento, no hay una
  APK Capacitor ya construida fuera de este repo (`CORE-Q-01` reabierta, corregido
  2026-08-27). Construirla (o decidir si entra a este repo) es un incremento aparte; mientras
  tanto `CORE-RF-05` (alcance LAN) queda sin diseñar.

## Depende de

`cis/`, `core/`, `cip/`, `web_admin/`, `core/frontend/` (código de aplicación reusado tal cual) y
de todo el trabajo de identidad de ADR-004 (Fases 1-3) — `KeycloakAdminService`,
`KeycloakAuthGuard`, el modelo de roles por Organization.

## Bloquea

Nada de forma dura — convive con `devops/onprem/` (Podman) de forma permanente (CORE-Q-02
resuelta: no lo reemplaza).

## Documentos relacionados

- [`aidlc-docs/sicsaft-core/`](../aidlc-docs/sicsaft-core) — INTENT/REQUIREMENTS/ARCHITECTURE
  completos.
- [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — identidad Keycloak, reusada
  tal cual acá.
- [ADR-005](../adr/ADR-005-postgres-pgboss-reemplaza-redis.md) — Redis sacado del ecosistema
  completo, `pg-boss`/memoria en su lugar.

## Desarrollo local

```bash
npm install
npm run dev          # electron-vite dev — abre la ventana, HMR real en el renderer
npm run typecheck
npm run lint:ci
npm test
npm run build         # compila main/preload/renderer a out/
```

`npm run dev`/`npm run build` arrancan la ventana pero **no** los servicios embebidos reales
todavía — `service-orchestrator.ts` va a fallar apenas intente arrancar Keycloak/Postgres sin los
binarios vendorizados en `resources/` (ver `resources/README.md`).

## Próximo paso sugerido

Ver "Próximo paso sugerido" en
[`aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md`](../aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md)
— confirmar el `capacitor.config.ts` real de la APK, vendorizar binarios (Postgres, JRE+Keycloak),
y completar la integración de `cis`/`core`/`cip` al orquestador (ya sin bloqueante externo desde
ADR-005).

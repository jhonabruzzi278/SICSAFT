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

🔴 Scaffold inicial (2026-08-27) — sin binarios embebidos todavía. Lo que SÍ está real y
verificado (`npm run typecheck`/`lint:ci`/`build`/`test` en verde):

- Estructura Electron completa (`electron-vite`: main/preload/renderer) con contextIsolation +
  sandbox — el renderer nunca tiene acceso directo a Node/secretos, todo pasa por IPC tipado
  (`src/shared/ipc-contract.ts`).
- `ManagedProcess` (`src/main/services/managed-process.ts`) — wrapper genérico de spawn/health-
  check/shutdown limpio, reusado por los 5 servicios embebidos (ADR-005 sacó a Redis, un servicio
  menos). Con tests reales.
- `keycloak-bootstrap.ts` — port a TypeScript de `devops/onprem/lib/Bootstrap-Keycloak.psm1`
  (realm, scopes, roles, Organization, clients OIDC), mismas llamadas a la Admin REST API ya
  verificadas reales en ADR-004 Fase 3.
- Wizard de primer arranque (datos del cliente → alta del Director → alta del Profesional de AFT)
  — UI completa, con los 2 primeros pasos ya llamando IPC real.

**Lo que NO está resuelto todavía** (ver
[`aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md`](../aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md)
para el detalle real de cada uno, sin minimizar):

- **Binarios embebidos sin vendorizar** (`resources/README.md`) — Postgres, JRE+Keycloak (ya no
  Redis, ADR-005 lo sacó del ecosistema completo). `service-orchestrator.ts` tira un error claro
  apenas llega al punto de arrancar `cis`/`core`/`cip`, a propósito — no lo oculta con un mock.
- `cis/`/`core/`/`cip/` embebidos: el código para correrlos (`node-backend-service.ts`) está
  escrito pero sin integrar al orquestador — sin bloqueante externo ahora, falta el wiring en sí
  (env vars, migraciones, la base `eventos_outbox` nueva de ADR-005).
- `KeycloakAdminService.crearUsuarioHuman` sin portar (paso "alta del Director" del wizard tira
  "no implementado" a propósito).
- El `capacitor.config.ts` real de la APK (ya construida fuera de este repo, ver arriba) sin
  confirmar todavía — determina si el mecanismo de red LAN de CORE-RF-05 repite el bug de secure
  context que ya rompió `.test` (ver `ARCHITECTURE.md`).

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

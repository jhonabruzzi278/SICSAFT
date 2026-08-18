# CIP — Centro de Inteligencia Patrimonial (SYS-06)

## Objetivo
Explota la información que produce el CORE: dashboards, KPI, informes, BI, alertas y análisis.
No se implementa dentro del CORE — el CORE produce datos, el CIP los interpreta.

## Estado
🟢 Primer dashboard implementado y verificado real de punta a punta (Fase 6, ROADMAP.md) —
`POST /inventarios` en CORE → trigger → `eventos_outbox` → `EventosOutboxDispatcher` → Redis/BullMQ
(`cip-eventos`) → `EventosOutboxWorker` de CIP → agregados en la base `cip` (propia, separada de
`core` — RNF-01/RNF-05) → `GET /dashboard/...`. Diseño completo en
[`aidlc-docs/`](aidlc-docs/00_PROJECT_METADATA.md) ([DOC-014](aidlc-docs/design-artifacts/DOC-014-cip-dashboard.md),
[DOC-018](aidlc-docs/design-artifacts/DOC-018-cip-servicio-nestjs.md)).

**Esqueleto NestJS** (`src/`, mismo patrón que `core/`/`cis/`, sin Zitadel — CIP no valida
identidad de operador): `DatabaseModule` (base `cip`), `ServiceTokenModule`
(`CIP_SERVICE_TOKEN`, protege la API propia), `CoreClientModule` (cliente HTTP hacia CORE con
`CORE_SERVICE_TOKEN`, deliberadamente sin circuit breaker/retry — BullMQ ya reintenta el job si
falla, ver DOC-018 3), `AgregacionModule` (worker + watcher), `DashboardModule` (API de lectura).

**`AgregacionModule`** (`src/agregacion/`):
- `EventosOutboxWorker` — consumidor BullMQ de `cip-eventos`, delega en `AgregacionService`.
- `AgregacionService` — por tipo de mensaje: `sesion-cerrada` recalcula veredicto (puerto de
  `app-qr-sicsaft/src/lib/verdict.ts`, DOC-018 5.1), cobertura incremental, activos fuera de área
  e incidencias; `evento` recalcula estado/categoría de activos y cobertura registrada desde el
  catálogo completo de la organización (DOC-018 5.2).
- `AgregacionRepository` — 8 tablas de agregados + `sync_estado`, todo por `codigoQr` (no
  `activoId` — `GET /catalogo`/`GET /inventarios/:id` de CORE no lo exponen, DOC-018 2.5/2.6).
- `SyncEstadoWatcher` — marca `sync_estado.al_dia = false` si hay mensajes pendientes en la cola y
  el último procesado supera el umbral (`CIP_UMBRAL_ATRASO_MINUTOS`, default 15) — RF-10.

**`DashboardModule`** (`src/dashboard/`): 8 endpoints de lectura (`GET /dashboard/cobertura`,
`/areas`, `/sesiones`, `/fuera-de-area`, `/no-localizados`, `/incidencias`, `/estado-activos`,
`/categorias`), paginados donde corresponde (RNF-02), todos devuelven `actualizadoEn`/`alDia`.

**Verificado real** (no solo mocks/unit): `docker build` + contenedor `cip` real levantado
(`devops/local/docker-compose.yml`, servicios `cip-migrate`/`cip`), un `POST /inventarios` real
contra `core` dentro de la red Docker, confirmado en el dashboard de CIP (`GET
/dashboard/cobertura` y `/dashboard/sesiones` devolviendo los datos reales calculados). Unit
100% stmts/lines/funcs + e2e reales contra Postgres (`test/dashboard.e2e-spec.ts`).

**Corrección sobre CORE necesaria para este incremento** (migración nueva, no se edita la ya
mergeada del PR #8): `eventos_outbox` gana `organizacion_id` (resuelto por el propio trigger vía
`LEFT JOIN` contra `activos`) y `ActivoCatalogo` (`GET /catalogo`) gana `familia` — ver
`core/README.md` "Outbox transaccional hacia CIP" y DOC-018 2.5/2.6.

## Primer dashboard previsto
Por organización: activos registrados, activos escaneados, % cobertura de inventario, áreas
controladas vs. pendientes, inventarios exitosos/aceptables/defectuosos, activos fuera de área,
activos no localizados, incidencias, y estado de los AFT (en servicio, mantenimiento, inactivo,
baja).

## Navegación prevista
Organización → Sede → Área → Ubicación → Categoría → Activo (con drill-down) — Sede se cae del
drill-down por ahora (DOC-018 2.7): no hay forma de resolver `sedeId` desde las APIs de lectura
de CORE disponibles hoy, extensión real de CORE fuera de alcance de este incremento.

## Depende de
CORE (fuente de datos) — vía su cola `cip-eventos` (async) para la ingesta y sus APIs de lectura
(`GET /catalogo`, `GET /inventarios/:id`) para releer el dato real; nunca contra la Base
Patrimonial transaccional directamente (RNF-01).

## Bloquea
Nada.

## Desarrollo local
Requiere una base `cip` real con las migraciones de [`migrations/`](migrations) aplicadas —
`docker compose up -d` desde `../devops/local` ya lo hace solo (servicio `cip-migrate`, mismo
patrón que `core-migrate`). Fuera de Docker:
```bash
cd cip
npm install
npm run migrate:up    # requiere CIP_DB_HOST/PORT/NAME/USER/PASSWORD en el entorno
npm run start:dev     # http://localhost:3002 y http://localhost:3002/health
npm run lint
npm run test:cov
npm run test:e2e      # requiere la base `cip` real, ver arriba
npm run build
```
Puerto por defecto `3002` (CIS=3000, CORE=3001) para poder correr los tres fuera de Docker sin
chocar.

## Documentos relacionados
[DOC-014](aidlc-docs/design-artifacts/DOC-014-cip-dashboard.md) — diseño del primer dashboard
(Inception AI-DLC). [DOC-018](aidlc-docs/design-artifacts/DOC-018-cip-servicio-nestjs.md) —
contrato de implementación (esqueleto, migraciones, worker, API), con las 4 correcciones
encontradas sobre el diseño inicial durante la implementación. Ver
[ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 5 (separar lectura analítica de la Base
Patrimonial transaccional).

## Próximo paso sugerido
Frontend implementado: [DOC-019](../web/aidlc-docs/design-artifacts/DOC-019-dashboard-cip-frontend.md)
resolvió las decisiones abiertas de DOC-014 7.1/7.2 — CIP se muestra como séptimo módulo del hub
de `web/` (no una app propia), y WEB nunca le habla directo a CIP: pasa por un proxy nuevo en CIS
(`src/dashboard-connector/` + `src/cip-client/`, mismo patrón que `qr-connector.controller.ts`/
`CoreClientService`), que retira la nota "provisional" de DOC-018 3 sobre `CIP_SERVICE_TOKEN` —
CIS es ahora el único llamador real de la API de lectura de CIP. Verificado en el navegador contra
MSW; pendiente verificación real de punta a punta (WEB→CIS→CIP→Postgres) dentro de Docker. Fuera
de alcance de este incremento: informe diario automático a hora fija (requiere scheduler + canal
de entrega, spec pptx) y Motor de Alertas (sin consumidor real todavía).

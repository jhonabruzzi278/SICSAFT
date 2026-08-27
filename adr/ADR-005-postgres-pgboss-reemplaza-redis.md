# ADR-005: Cola de eventos y rate-limiting — Postgres (pg-boss) reemplaza a Redis/BullMQ

## Status

Aceptada — enmienda [ADR-001](ADR-001-stack-backend-nestjs.md) (reemplaza únicamente la cláusula
"Cache y colas: Redis"; el resto de ADR-001 — NestJS, Vite/React, PostgreSQL — sigue vigente sin
cambios). Implementación en progreso: `core/` → `cip/` → `cis/` → `devops/` (los 3 perfiles:
`local/`, `prod/`, `onprem/`).

## Context

Surgió durante el diseño de `sicsaft-core.exe` ([aidlc-docs/sicsaft-core/](../aidlc-docs/sicsaft-core)):
Redis Inc. no publica binario oficial de Windows, y las alternativas reales para empaquetarlo
embebido en un `.exe` de escritorio son todas insatisfactorias — Memurai (el socio oficial de Redis
Inc. para Windows desde 2025) prohíbe producción en su edición gratis y no publica precio en la
edición paga; los forks comunitarios (`tporadowski/redis`, `redis-windows/redis-windows`) no tienen
respaldo del fabricante. Ver `aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md` "Redis —
riesgo real" para el detalle completo de esa investigación (2026-08-27).

En vez de resolver esto solo para el perfil embebido, se decidió (confirmado con el usuario)
resolverlo para **todo el ecosistema** — los tres perfiles de `devops/` (`local/`, `prod/`,
`onprem/`) dejan de depender de Redis, no solo `sicsaft-core.exe`.

### Uso real de Redis hoy (confirmado leyendo código, no de memoria)

Redis, provisionado desde ADR-001 pero sin consumidor hasta Fase 6, termina usado por **tres**
sistemas:

- `cis/src/rate-limit/redis-rate-limiter.ts` — rate-limiting por operador (WAF 4): `INCR`+`PEXPIRE`
  atómico vía script Lua, ventana fija. Falla abierto si Redis no responde.
- `cis/src/device-registry/device-registry.service.ts` — "un dispositivo por operador" (DOC-002 1):
  un `SET ... PX <ttlMs>` por operador. También falla abierto — es una restricción de negocio
  complementaria, no un control de seguridad (Keycloak ya autentica).
- `core/src/eventos-outbox/` (productor) + `cip/src/agregacion/eventos-outbox.worker.ts`
  (consumidor) — cola BullMQ `cip-eventos`: CORE hace polling de su propia tabla `eventos_outbox`
  cada 5s y publica a la cola; CIP la consume para recalcular agregados (DOC-018 5).

**Hallazgo importante que cambia el diseño de reemplazo**: `cis/` no tiene base Postgres propia —
nunca la tuvo, es un proxy delgado sin estado (`ioredis` es su única dependencia con estado, "Primer
consumidor de Redis en el codigo del ecosistema" según el propio comentario de
`devops/local/docker-compose.yml`). Introducirle Postgres solo para rate-limiting/device-registry
sería agregar una dependencia con estado que `cis/` nunca tuvo, contradiciendo su rol documentado
("proxy delgado hacia CORE", `CLAUDE.md`). `cis/` corre como instancia única en los tres perfiles
hoy (sin réplicas) — no hay necesidad real de un backend compartido entre procesos para estas dos
piezas.

**Segundo hallazgo que condiciona el diseño**: `core/` y `cip/` tienen bases Postgres **separadas**
a propósito (RNF-01/RNF-05, DOC-018 §"Base real... separada de core") — CIP no puede leer la base de
CORE directamente. Una cola construida sobre Postgres (pg-boss) necesita que productor y consumidor
apunten a la **misma** base+esquema para intercambiar mensajes — no hay bróker externo de por medio
como con Redis. Apuntar pg-boss a la base propia de `core/` y darle a `cip/` credenciales hacia ella
rompería RNF-01. La solución no es elegir una de las dos bases existentes, sino agregar una tercera,
dedicada y mínima, solo para la cola.

## Decision

**Dos tecnologías distintas para dos problemas distintos — no se reemplaza Redis por "otro Redis":**

### 1. Cola de eventos CORE→CIP: [`pg-boss`](https://github.com/timgit/pg-boss) sobre una base Postgres nueva y dedicada

- Base nueva `eventos_outbox` en el mismo servidor Postgres que ya comparten `core`/`cip`/`cip`
  (mismo patrón que `devops/*/postgres/init/`), con un único usuario/rol compartido
  (`EVENTOS_OUTBOX_DATABASE_URL`) que `core/` y `cip/` reciben ambos — es infraestructura de cola
  explícitamente compartida por diseño, mismo tipo de recurso que Redis ya era, no una violación
  nueva de RNF-01 (que protege la base **de dominio** de cada sistema, no existe una regla que
  prohíba un recurso de mensajería compartido).
- `pg-boss` gestiona su propio esquema (`pgboss` por defecto) automáticamente vía `boss.start()` —
  excepción deliberada a "toda tabla nueva pasa por `node-pg-migrate`" (`CLAUDE.md`): es un esquema
  interno de una librería de terceros ampliamente usada para este propósito exacto, mismo criterio
  ya aceptado para el esquema propio que gestiona Keycloak.
- Un único queue `cip-eventos` (nombre sin cambios) — el discriminante `kind` (`'sesion-cerrada'` |
  `'evento'`) ya vivía en el payload del mensaje (`EventosOutboxMensaje`), nunca en el nombre de job
  de BullMQ (el worker ya despachaba por `job.data`, nunca por `job.name`) — el port es 1:1 sin
  reestructurar el contrato de mensajes.
- Semántica *at-least-once* preservada sin config especial: si el worker muere a mitad de un job,
  pg-boss lo vuelve a ofrecer tras el timeout de la lease — mismo comportamiento que ya asumía
  DOC-018 5.3 con BullMQ (los handlers ya son idempotentes, upserts/`DELETE`+`INSERT` completos).
- `SyncEstadoWatcher.queue.getWaitingCount()` (RF-10, DOC-018 5.4) → `boss.getQueue(name).readyCount`
  — mismo concepto ("cuántos mensajes esperan"), API distinta.
- CI no necesita la base nueva: `core-ci.yml`/`cip-ci.yml` corren en jobs aislados (nunca se levantan
  juntos), así que cada uno apunta `EVENTOS_OUTBOX_DATABASE_URL` a su propio Postgres efímero de CI
  — no hay intercambio real de mensajes entre procesos que verificar en ese contexto, igual que hoy
  con el Redis efímero de cada workflow.

### 2. Rate-limiting y device-registry de `cis/`: en memoria del propio proceso, sin librería nueva

- `RedisRateLimiter` → `InMemoryRateLimiter` (`Map<string, {count, expiraEn}>`, mismo algoritmo de
  ventana fija que el script Lua actual) — mismo contrato público (`RateLimitOptions`/
  `RateLimitResult`), `RateLimitGuard` no cambia.
- `DeviceRegistryService` → mismo `Map` con expiración vía `setTimeout`, mismo comportamiento
  "falla abierto"/best-effort ya documentado (perder este estado en un reinicio del proceso ya era
  aceptable con Redis, que tampoco persistía en disco por defecto).
- Sin `RateLimiterPostgres`/`rate-limiter-flexible`: se evaluó, pero exige que `cis/` tenga una
  conexión Postgres — que hoy no existe y contradice su diseño de proxy sin estado. Si algún día
  `cis/` necesita escalar a múltiples réplicas, este componente es el primero en revisarse (no se
  resuelve preventivamente acá, YAGNI).
- `ioredis` se elimina por completo de `cis/` — deja de tener ninguna dependencia con estado.

## Consequences

- Redis desaparece de los 3 stacks de `devops/` (`local/`, `prod/`, `onprem/`) — un servicio menos
  que operar, parchear y monitorear en cada uno; también desaparece del `docker-compose.yml`
  embebido conceptual de `sicsaft-core.exe` (ya no hace falta resolver el spike de Redis en Windows
  documentado en `aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md` — ese documento se
  actualiza para reflejar esto).
- Nueva base Postgres `eventos_outbox` en los 3 perfiles de `devops/` — un `init/xx-eventos-outbox.sh`
  más (mismo patrón que `02-core.sh`/`03-cip.sh`), un usuario/rol nuevo en cada `.env.example`.
- `core/`, `cip/`: pierden `ioredis`+`bullmq`, ganan `pg-boss`. `cis/`: pierde `ioredis`, no gana
  ninguna dependencia nueva.
- `DOC-018` (`aidlc-docs/cip/design-artifacts/DOC-018-cip-servicio-nestjs.md`) sección 5.3/7 se
  actualiza: "BullMQ" → "pg-boss" donde describe el mecanismo de entrega, sin cambiar el contrato de
  mensajes ni la lógica de agregación.
- Cobertura de tests: los tres sistemas exigen 100% líneas/funciones (`package.json` →
  `jest.coverageThreshold`) — todo código nuevo (`InMemoryRateLimiter`, wrappers de `pg-boss`) lleva
  tests unitarios completos, mismo estándar que el código que reemplaza.
- Cualquier sistema nuevo que necesite colas o rate-limiting distribuido parte de `pg-boss`/
  in-memory por defecto — reabrir esta decisión para un caso puntual (ej. volumen que Postgres no
  sostenga) requiere su propio ADR justificando el motivo real, mismo criterio que ADR-001 ya
  establece para sí mismo.

## Alternativas descartadas

- **Empaquetar Redis para Windows** (`redis-windows/redis-windows` u otro fork) — resolvía solo el
  perfil embebido, no simplificaba `local`/`prod`, y mantenía el riesgo de un binario sin respaldo
  del fabricante. Documentado como opción más rápida en `ARCHITECTURE.md` si este ADR necesitara
  revertirse.
- **Memurai Enterprise** — camino con respaldo oficial de Redis Inc., pero de pago sin lista de
  precios pública; introduce un costo recurrente por instalación de cliente que no se justifica
  frente a una alternativa gratuita y ya embebida (Postgres).
- **`RateLimiterPostgres` (rate-limiter-flexible) en `cis/`** — descartada por el hallazgo de que
  `cis/` no tiene Postgres hoy; agregarlo solo para esto es más invasivo que un `Map` en memoria
  para un componente que ya es best-effort/falla-abierto por diseño.

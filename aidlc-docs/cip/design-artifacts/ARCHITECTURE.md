# Architecture — CIP: primer dashboard (Fase 6)

## 1. Vista general

```mermaid
flowchart LR
    subgraph CORE["core (Postgres 'core')"]
        EV[eventos] -- "trigger AFTER INSERT" --> OB[eventos_outbox]
        SI[sesiones_inventario + inventarios]
        AC[activos]
    end

    OB -- "poll cada N s" --> DISP[core: EventosOutboxDispatcher\nsrc/eventos-outbox/]
    DISP -- "publica" --> Q[(Postgres 'eventos_outbox'\ncola pg-boss, cip-eventos)]

    Q -- "consume" --> W[cip: worker de agregacion\nsrc/agregacion/]
    W -- "lee vía GET /catalogo, /inventarios,\n/inventarios/:id (CORE, ServiceTokenGuard)" --> COREAPI[CORE API]
    W -- "escribe agregados" --> CIPDB[(Postgres 'cip'\npropia, solo CIP escribe)]

    API[cip: API de lectura\nGET /dashboard/...] -- lee --> CIPDB
    UI[Frontend CIP\n(Construction posterior)] --> API
```

**Por qué el worker relee de CORE en vez de reconstruir todo desde `detalle jsonb` del evento**:
un evento (`eventos.detalle`) es una notificación de "algo cambió", no el dato completo que un
agregado necesita (ej. para recalcular `COBERTURA_ORGANIZACION` hace falta saber cuántos activos
tiene la organización, no solo que uno se escaneó). El worker usa el evento como **señal de qué
recalcular**, y trae el dato real por las APIs de lectura que CORE ya expone (`GET /catalogo`,
`GET /inventarios`, `GET /inventarios/:id`) — mismas que usa WEB, mismo contrato, sin endpoints
nuevos en CORE para este incremento. Igual que CIS habla con CORE, CIP también pasa por
`ServiceTokenGuard` (`CIP_SERVICE_TOKEN`, mismo mecanismo que `CORE_SERVICE_TOKEN`) — nunca toca
la base `core` directamente.

## 2. Por qué dos saltos (CORE→cola→worker) y no un trigger que llame HTTP directo

Un trigger de Postgres no puede llamar HTTP de forma confiable (sin extensiones no estándar) ni
debe hacerlo — bloquearía la transacción que lo disparó. El diseño separa:

1. **`eventos_outbox`** (dentro de la transacción de CORE, ver `DOMAIN_MODEL.md` 1) — garantiza
   que ningún evento se pierde, sin acoplar la escritura transaccional a la disponibilidad de la
   cola.
2. **`EventosOutboxDispatcher`** (proceso separado dentro de `core/`, un `@Cron`/intervalo simple
   de NestJS — no un endpoint HTTP) — hace polling de `eventos_outbox WHERE publicado = false`,
   publica a la cola, marca `publicado = true`. Si la base de la cola está caída, simplemente no
   avanza — los eventos quedan pendientes, no se pierden (RNF-03).
3. **Cola `cip-eventos` (pg-boss)** — [ADR-005](../../../adr/ADR-005-postgres-pgboss-reemplaza-redis.md)
   (2026-08-27) reemplaza a Redis/BullMQ: una base Postgres dedicada (`eventos_outbox`, separada de
   `core`/`cip` a propósito — RNF-01/RNF-05, `EVENTOS_OUTBOX_DATABASE_URL`) que comparten CORE
   (productor) y CIP (consumidor). Antes de ese ADR era Redis/BullMQ (ya provisionado desde
   ADR-001, primer consumidor real de colas del ecosistema en su momento).
4. **Worker de CIP** — proceso propio de `cip/` (no un módulo dentro de CORE) para cumplir WAF 8
   "CIP: escala independiente del CORE" — un pico de recalculo de agregados no puede competir por
   CPU/memoria con el camino síncrono de `POST /inventarios`.

## 3. Qué eventos importan al agregado (filtro del trigger/dispatcher)

| `eventos.tipo` | Agregado que recalcula | Alcance del recalculo |
|---|---|---|
| `alta` | `COBERTURA_ORGANIZACION`, `ESTADO_ACTIVO_RESUMEN`, `CATEGORIA_ACTIVO_RESUMEN` | Solo la organización del activo |
| `escaneo_qr` | `COBERTURA_ORGANIZACION`, `CONTROL_AREA` | Solo el área/organización de la sesión — **no** dispara por cada escaneo individual, ver 4 |
| `mantenimiento` / `inactivo` | `ESTADO_ACTIVO_RESUMEN` | Solo la organización del activo |
| `baja` / `reincorporacion` | `ESTADO_ACTIVO_RESUMEN`, `ACTIVO_NO_LOCALIZADO` (si aplica) | Solo la organización del activo |
| `traslado` | `ACTIVO_FUERA_DE_AREA`, `DIFERENCIA_UBICACION` (DOC-026) | Solo el área/ubicación origen/destino |
| `cambio_responsable` | `HISTORIAL_RESPONSABLE_ACTIVO` (DOC-026, RF-13, agregado 2026-08-25) | Solo el activo/organización afectados |
| `movimiento`, `salida_autorizada`, `salida_no_autorizada`, `lectura_rfid` | Ninguno todavía — sin métrica que los use (YAGNI) | — |
| — (job periódico, no evento) | `EVOLUCION_PATRIMONIO_SNAPSHOT` (DOC-026, RF-16) | Snapshot diario por organización, no reacciona a un evento puntual |

`baja_sugerida` (Fase 3.1) queda deliberadamente fuera: es informativo para el Administrador
Patrimonial dentro de WEB, no una métrica de dashboard todavía.

**Dos agregados de DOC-026 no entran en esta tabla porque no reaccionan a un solo tipo de evento**:
`INCIDENCIA_AREA_RESUMEN` se recalcula en el mismo mensaje debounced `sesion-cerrada` que ya
recalcula `INCIDENCIA` hoy (ver 4) — solo le agrega el `areaId` resuelto en ese mismo paso.
`RIESGO_ACTIVO` es un recálculo periódico (mismo job que `EVOLUCION_PATRIMONIO_SNAPSHOT`) que lee
los demás agregados ya calculados (incidencias, cambios de responsable, criticidad, tiempo fuera de
área) en vez de reaccionar a un evento puntual — ver DOC-026 5.

## 4. `escaneo_qr` es de alto volumen — cómo se evita recalcular por cada lectura

Una sesión de inventario puede traer decenas de escaneos en un solo `POST /inventarios`, cada uno
genera su propio evento `escaneo_qr` (`InventariosService.registrarEventosDeEscaneo`, ya
implementado en Fase 2/3.1). Recalcular `CONTROL_AREA`/`COBERTURA_ORGANIZACION` por cada evento
individual sería `N` recalculos redundantes para una sola sesión cerrada.

**Decisión**: el dispatcher agrupa (`debounce`) por `sesionId` (viene en `eventos.detalle`) antes
de encolar — publica **un solo mensaje** `sesion-cerrada` a la cola cuando termina de procesar el
lote de outbox de una corrida, no un mensaje por evento. El worker de CIP entonces trae la sesión
completa vía `GET /inventarios/:id` (un solo request) y recalcula desde ahí — mismo criterio que ya
usa `POST /inventarios` en CORE (procesa la sesión entera, no escaneo por escaneo, DOC-006 3).

## 5. Veredicto: recalculado, no reenviado

Hallazgo real de este diseño: `app-qr-sicsaft` calcula el veredicto de sesión
(exitoso/aceptable/defectuoso, `src/lib/verdict.ts`, Fase 3.1) **solo en el cliente** — el payload
de `POST /inventarios` (`cis/src/qr-connector/qr-connector.schemas.ts`) nunca lo envía, y
`sesiones_inventario` no tiene una columna para guardarlo. RF-03/US-03 lo piden igual.

**Opciones consideradas**:
1. Agregar un campo `veredicto` al contrato `POST /inventarios` y a `sesiones_inventario` — amplía
   la superficie de escritura de CORE para un dato que es 100% derivable de datos que CORE ya
   tiene (activos esperados en el área vs. escaneos reales).
2. Recalcularlo del lado de CIP, a partir de la misma sesión que ya trae `GET /inventarios/:id`
   (`escaneos[]` con su `resultado`) — misma lógica de `verdict.ts`, portada (no importada — CIP no
   depende del código de APP QR) a `cip/src/agregacion/`.

**Decisión: opción 2.** No toca CORE, no amplía su contrato de escritura para un dato puramente de
lectura, y mantiene la regla de una sola fuente de verdad para "qué activos se esperaban en esta
área" (el catálogo de CORE, no lo que el cliente cree que faltó). Riesgo aceptado: si la lógica de
veredicto cambia, hay que actualizarla en dos lugares (APP QR para el resumen inmediato en pantalla,
CIP para el dashboard agregado) — aceptable porque son necesidades distintas (una es feedback
instantáneo offline-first, la otra es un agregado histórico contra datos server-side ya
confirmados) y de bajo riesgo de divergencia (la regla es simple, 4 líneas, ver
`app-qr-sicsaft/src/lib/verdict.ts`).

## 6. API de lectura de CIP

`GET /dashboard/cobertura`, `/dashboard/areas`, `/dashboard/sesiones`, `/dashboard/fuera-de-area`,
`/dashboard/no-localizados`, `/dashboard/incidencias`, `/dashboard/estado-activos`,
`/dashboard/categorias` — todos aceptan `organizacionId` obligatorio y `sedeId`/`areaId`/
`ubicacionId` opcionales (RF-08, drill-down), paginados donde el resultado es una lista (RNF-02),
y devuelven `actualizadoEn` (de `SYNC_ESTADO`) en cada respuesta (RF-10). Mismo patrón de
autenticación que CORE: `ServiceTokenGuard` si el consumidor es un backend (frontend de CIP futuro,
o CIS si algún día expone un puente) — decisión de qué cliente llama a CIP directo vs. a través de
CIS queda para el incremento de Construction que construya el frontend (no bloquea este diseño de
ingesta).

## 7. Degradación (RF-10, WAF 8)

- Si la base `eventos_outbox` está caída: el dispatcher deja de publicar, los eventos se acumulan
  en `eventos_outbox` (nunca se pierden) — `POST /inventarios` de CORE sigue funcionando normal, no
  depende de esa base para su camino síncrono.
- Si el worker de CIP está caído: los mensajes se acumulan en la cola (pg-boss persiste en
  Postgres, ADR-005) — se procesan al volver.
- Si la base `cip` está caída: la API de lectura de CIP devuelve 503 explícito (nunca un dashboard
  a medio pintar) — pero esto es un caso distinto de "datos atrasados": es la fuente de lectura la
  que no responde, no algo que "últimos datos conocidos" pueda resolver.
- `SYNC_ESTADO.alDia` es `false` cuando `ahora() - ultimoEventoProcesadoEn` supera un umbral
  configurable (default 15 min) — el frontend lo usa para mostrar un aviso, la API sigue
  respondiendo 200 con los datos que tiene.

## 8. Qué NO se construye en este incremento (YAGNI, ver WAF 9 y `requirements/INTENT.md`)

- Réplica de lectura de Postgres para `core` — la base `cip` separada ya logra el aislamiento que
  pedía WAF 5, sin la complejidad operativa de una réplica streaming todavía.
- Motor de datos columnar/analítico — Postgres alcanza para agregados de este volumen.
- Caché adicional sobre la API de lectura de CIP — sus tablas ya son agregados precalculados, un
  caché encima sería optimizar algo que todavía no se midió como lento.

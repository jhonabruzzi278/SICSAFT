# DOC-018 — CIP: servicio NestJS, migraciones, worker y API de lectura (segundo incremento, Fase 6)

Contrato de implementación del segundo incremento de Construction de Fase 6. El primer incremento
(outbox transaccional del lado de CORE, DOC-014 1/6) ya está mergeado
([PR #8](https://github.com/jhonabruzzi278/SICSAFT/pull/8)). Este documento no repite las
decisiones ya tomadas en [DOC-014](DOC-014-cip-dashboard.md)/[ARCHITECTURE.md](ARCHITECTURE.md) —
las hace concretas: nombres de archivo, columnas exactas, contrato del worker, endpoints.

## 1. Alcance de este incremento

- Esqueleto NestJS de `cip/` (mismo patrón que `core/`/`cis/`, `CLAUDE.md` "Al agregar un
  sistema nuevo").
- Base de datos `cip` propia, migraciones node-pg-migrate para las 7 tablas de agregados +
  `sync_estado` (`DOMAIN_MODEL.md` 2).
- Worker consumidor de la cola `cip-eventos` (BullMQ) — recalcula agregados llamando a las APIs de
  lectura de CORE.
- API de lectura (`GET /dashboard/...`) — RF-01 a RF-09.
- Dockerfile, `cip-ci.yml`, wiring en `devops/local/docker-compose.yml`.
- **Fuera de alcance todavía**: frontend, informe diario automático (ver `requirements/INTENT.md`).

## 2. Corrección encontrada sobre la migración ya mergeada: falta `organizacion_id`

Al diseñar el worker (5) se encontró que el mensaje `{ kind: 'evento', eventoId, tipo }`
(`core/src/eventos-outbox/eventos-outbox.types.ts`, ya mergeado) no alcanza: el worker necesita
saber la `organizacionId` del activo para recalcular `ESTADO_ACTIVO_RESUMEN`/
`CATEGORIA_ACTIVO_RESUMEN`/`COBERTURA_ORGANIZACION`, y **CIP no puede resolverlo consultando la
base `core` directamente** (RNF-01) ni existe un `GET /eventos/:id` en CORE para pedirlo por HTTP.

**No se edita la migración `1755500000000` ya mergeada** (regla del repo, ver `git-workflow.md` /
convención ya usada en `1755200000000`→`1755300000000`). Se agrega una migración nueva:

`core/migrations/1755600000000_eventos-outbox-organizacion.ts`:
- `ALTER TABLE eventos_outbox ADD COLUMN organizacion_id text;`
- Reemplaza `fn_eventos_outbox_insertar()` (`CREATE OR REPLACE FUNCTION`, no hace falta recrear el
  trigger) para resolver `organizacion_id` con un `JOIN` contra `activos` cuando `NEW.activo_id`
  no es null:
  ```sql
  INSERT INTO eventos_outbox (id, evento_id, tipo, sesion_id, organizacion_id)
  SELECT gen_random_uuid()::text, NEW.id, NEW.tipo, NEW.detalle ->> 'sesionId', activos.organizacion_id
  FROM (SELECT NEW.id) AS uno LEFT JOIN activos ON activos.id = NEW.activo_id
  -- LEFT JOIN, no INNER: si algun dia uno de estos 7 tipos llegara con activo_id NULL, la fila de
  -- outbox se sigue insertando (con organizacion_id NULL) en vez de desaparecer en silencio.
  ```
- `EventoOutboxPendiente`/`EventosOutboxMensaje` (`core/src/eventos-outbox/eventos-outbox.types.ts`)
  ganan `organizacionId: string | null`; el mensaje `evento` de la cola pasa a
  `{ kind: 'evento', eventoId, tipo, organizacionId }`.
- `EventosOutboxRepository.findPendientes`/`EventosOutboxDispatcher` — un `SELECT`/mapeo más, sin
  cambios de lógica.

Este ajuste se implementa **antes** que el resto de este incremento (es una pieza de CORE, mismo
criterio que el primer incremento) y es la única modificación a código ya mergeado que este
documento pide.

## 2.5 Segunda corrección encontrada: CIP no puede usar `activoId`, solo `codigoQr`

Al diseñar el contrato de `CoreClientService` (3) se encontró que **ninguna** API de lectura de
CORE que CIP puede usar expone el `id` interno del activo:
- `GET /catalogo` (`ActivoCatalogo`, `core/src/patrimonial/activo.types.ts`) trae `codigoQr`,
  `areaId`, `estado`, `organizacionId` — sin `id`.
- `GET /inventarios/:id` (`EscaneoDetalle`, `core/src/inventarios/sesion-inventario.repository.ts`)
  trae `codigoQr`, `resultado`, `observaciones` — sin `id` ni área esperada.

Agregar `id` a esos DTOs es un cambio de contrato de CORE que también afecta a WEB (mismo
`ActivoCatalogo` que ya consume `web/`, Fase 5) — fuera de alcance de este incremento, y
innecesario: **`codigoQr` ya es único por activo** (constraint `UNIQUE` en `activos.codigo_qr`,
migración `1755100000000`) y es el identificador que ya cruza la frontera CORE↔CIS↔APP QR en todo
el ecosistema. Todas las tablas de agregados de 4 que en `DOMAIN_MODEL.md` decían `activoId` se
corrigen acá a `codigoQr` — ver `DOMAIN_MODEL.md` (ya actualizado). Ninguna otra decisión de
`ARCHITECTURE.md`/DOC-014 cambia.

Consecuencia sobre el worker (5.1): para saber el **área esperada** de un `codigoQr` fuera de
lugar, el handler de `sesion-cerrada` necesita el catálogo completo de la organización (no solo el
detalle de la sesión) — llama al mismo `obtenerCatalogoCompleto(organizacionId)` que ya usa el
handler de `evento` (5.2), construye un `Map<codigoQr, ActivoCatalogo>` y cruza contra los
escaneos de la sesión.

## 2.6 Tercera corrección encontrada: `GET /catalogo` no exponía `familia` cruda

`ActivoCatalogo` (`core/src/patrimonial/activo.types.ts`) solo exponía `nombre` (compuesto por
`construirNombreActivo` — "Dell Latitude 5440" o "Notebook" o "Equipo Computacional —
Informática", nunca la categoría cruda). RF-09 (gráfico circular por `familia`) no se puede
resolver parseando ese string. Extensión aditiva, mismo criterio que `estadoDeclarado`/
`bajaSugerida` en Fase 3.1: se agrega `familia: string` a `ActivoCatalogo` y a
`ActivoRepository.toActivoCatalogo` (ya seleccionaba `familia` de la base para componer `nombre`,
solo faltaba exponerla) — no rompe a WEB, que ya consume este mismo tipo y simplemente ignora el
campo nuevo.

## 2.7 Cuarto ajuste: `control_area` pierde `sede_id`

`SesionDetalle` (`GET /inventarios/:id`) trae `areaId`/`ubicacionId`, nunca `sedeId` — y no existe
un `GET /ubicaciones/:id` de solo lectura para resolverlo (`GET /ubicaciones?sedeId=` es la
dirección inversa). Agregar ese endpoint es una extensión real de CORE, no una corrección menor
como las anteriores — se deja fuera de este incremento (YAGNI: RF-02 solo pide "áreas controladas
vs. pendientes", agrupar por sede es un enriquecimiento de UI que el frontend puede resolver más
adelante cruzando contra `GET /areas` de CORE si hace falta). `control_area.sede_id` se elimina de
`DOMAIN_MODEL.md` 2 y de la migración de 4.

## 3. Esqueleto del servicio `cip/`

Mismo stack que CORE (ADR-001: NestJS/TypeScript, `node-pg-migrate`, `pg`, `zod`) — **sin
Zitadel**: CIP no valida identidad de operador (mismo razonamiento que CORE, DOC-014 4). Reusa el
patrón `ServiceTokenGuard`/`ServiceTokenModule` **dos veces**, con roles distintos:
- Como **cliente**: `CoreClientService` (`src/core-client/`) llama a CORE con el header
  `x-internal-service-token: ${CORE_SERVICE_TOKEN}` — mismo mecanismo que ya usa CIS
  (`cis/src/core-client/`), CIP es un segundo consumidor del mismo contrato.
- Como **servidor**: la API de lectura de CIP (6) exige su propio `x-internal-service-token:
  ${CIP_SERVICE_TOKEN}` (secreto nuevo, no reusar `CORE_SERVICE_TOKEN`) — hasta que exista un
  frontend con su propio modelo de auth, cualquier llamador interno del ecosistema (ej. WEB/CIS si
  algún día necesitan mostrar el dashboard) se autentica igual que CIS↔CORE. Decisión provisional,
  ya anotada como abierta en DOC-014 7.1 — no bloquea este incremento.

```
cip/
  src/
    main.tsx? no — main.ts (backend, sin frontend en este incremento)
    app.module.ts
    database/              DatabaseModule (pool hacia la base `cip`, mismo patron que core/src/database/)
    common/auth/            ServiceTokenGuard (servidor) — copiado/adaptado de core/src/common/auth
    core-client/             CoreClientService (cliente hacia CORE) — adaptado de cis/src/core-client
    agregacion/              Worker BullMQ + logica de recalculo por tipo de evento (5)
      veredicto.ts            Puerto de app-qr-sicsaft/src/lib/verdict.ts (ARCHITECTURE.md 5)
    dashboard/               Controller + repository de lectura (6)
  migrations/                node-pg-migrate, mismo mecanismo que core/migrations/
  scripts/migrate.js          copiado de core/scripts/migrate.js sin cambios
  test/                       e2e (mismo patron que core/test/)
  Dockerfile
  package.json
```

## 4. Migraciones de la base `cip`

Base Postgres separada de `core`, mismo Postgres compartido del stack local (nuevo
`devops/local/postgres/init/03-cip.sh`, mismo patrón que `02-core.sh`: `CIP_DB_USER`/
`CIP_DB_PASSWORD` nuevos en `.env`/`.env.example`).

`cip/migrations/<ts>_schema-agregados.ts` — traduce `DOMAIN_MODEL.md` 2 a columnas reales:

```ts
pgm.createTable('cobertura_organizacion', {
  organizacion_id: { type: 'text', primaryKey: true },
  activos_registrados: { type: 'integer', notNull: true, default: 0 },
  activos_escaneados: { type: 'integer', notNull: true, default: 0 },
  porcentaje_cobertura: { type: 'numeric', notNull: true, default: 0 },
  actualizado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
});

pgm.createTable('control_area', {
  area_id: { type: 'text', primaryKey: true },
  organizacion_id: { type: 'text', notNull: true },
  controlada_en_periodo: { type: 'boolean', notNull: true, default: false },
  ultima_sesion_en: { type: 'timestamptz' },
});
pgm.createIndex('control_area', 'organizacion_id');

pgm.createTable('veredicto_sesion', {
  sesion_id: { type: 'text', primaryKey: true },
  organizacion_id: { type: 'text', notNull: true },
  area_id: { type: 'text', notNull: true },
  veredicto: { type: 'text', notNull: true, check: "veredicto IN ('exitoso','aceptable','defectuoso')" },
  fecha_cierre: { type: 'timestamptz', notNull: true },
});
pgm.createIndex('veredicto_sesion', 'organizacion_id');

pgm.createTable('activo_fuera_de_area', {
  codigo_qr: { type: 'text', primaryKey: true },
  organizacion_id: { type: 'text', notNull: true },
  area_real_id: { type: 'text', notNull: true },
  area_esperada_id: { type: 'text', notNull: true },
  detectado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
});
pgm.createIndex('activo_fuera_de_area', 'organizacion_id');

pgm.createTable('activo_no_localizado', {
  codigo_qr: { type: 'text', primaryKey: true },
  organizacion_id: { type: 'text', notNull: true },
  desde_en: { type: 'timestamptz', notNull: true },
});
pgm.createIndex('activo_no_localizado', 'organizacion_id');

// PK compuesta, no un id propio: EscaneoDetalle (GET /inventarios/:id) no expone un id de fila
// por escaneo (core/src/inventarios/sesion-inventario.repository.ts) — sesion_id + codigo_qr ya
// es unico (un mismo codigo_qr aparece una sola vez por sesion salvo 'ya_escaneado', que no
// clasifica 'con_incidencia').
pgm.createTable('incidencia', {
  sesion_id: { type: 'text', notNull: true },
  codigo_qr: { type: 'text', notNull: true },
  organizacion_id: { type: 'text', notNull: true },
  observaciones: { type: 'text', notNull: true },
  fecha: { type: 'timestamptz', notNull: true },
});
pgm.addConstraint('incidencia', 'incidencia_pkey', { primaryKey: ['sesion_id', 'codigo_qr'] });
pgm.createIndex('incidencia', 'organizacion_id');

pgm.createTable('estado_activo_resumen', {
  organizacion_id: { type: 'text', notNull: true },
  estado: { type: 'text', notNull: true, check: "estado IN ('activo','mantenimiento','inactivo','dado_de_baja','en_transito','extraviado')" },
  cantidad: { type: 'integer', notNull: true, default: 0 },
});
pgm.addConstraint('estado_activo_resumen', 'estado_activo_resumen_pkey', { primaryKey: ['organizacion_id', 'estado'] });

pgm.createTable('categoria_activo_resumen', {
  organizacion_id: { type: 'text', notNull: true },
  // area_id NULL = total sin filtrar (DOMAIN_MODEL.md 2) — text vacio no sirve como parte de una
  // PK compuesta consistente, se usa el literal '(todas)' como valor de esa fila.
  area_id: { type: 'text', notNull: true, default: '(todas)' },
  familia: { type: 'text', notNull: true },
  cantidad: { type: 'integer', notNull: true, default: 0 },
});
pgm.addConstraint('categoria_activo_resumen', 'categoria_activo_resumen_pkey', {
  primaryKey: ['organizacion_id', 'area_id', 'familia'],
});

// Auxiliar para el conteo incremental de cobertura (5.1 punto 4) — no forma parte del modelo de
// lectura expuesto por la API (6), es contabilidad interna del worker.
pgm.createTable('activo_escaneado_alguna_vez', {
  codigo_qr: { type: 'text', primaryKey: true },
  organizacion_id: { type: 'text', notNull: true },
});
pgm.createIndex('activo_escaneado_alguna_vez', 'organizacion_id');

pgm.createTable('sync_estado', {
  singleton: { type: 'text', primaryKey: true, default: 'global' },
  ultimo_evento_procesado_en: { type: 'timestamptz' },
  al_dia: { type: 'boolean', notNull: true, default: true },
});
pgm.sql(`INSERT INTO sync_estado (singleton) VALUES ('global');`);
```

Nota de diseño sobre `estado_activo_resumen`/`categoria_activo_resumen`: no son "agregados que se
incrementan/decrementan por evento" — el worker los **reescribe completos** por organización en
cada recálculo (`DELETE ... WHERE organizacion_id = $1` + `INSERT` desde el catálogo recién leído,
en una transacción). Decisión deliberada (5): evita bugs de contador desincronizado (un evento
perdido/duplicado no deja el conteo mal para siempre, se autocorrige en el próximo recálculo) a
costa de recalcular sobre el catálogo completo de la organización — aceptable al volumen de este
MVP (mismo criterio que ya aceptó `ContratoRepository.findPagina` paginando en memoria,
`core/README.md`).

## 5. Worker — contrato por tipo de mensaje

`cip/src/agregacion/eventos-outbox.worker.ts` — un `Worker` de BullMQ sobre la cola `cip-eventos`
(mismo nombre, mismo Redis que ya escribe `EventosOutboxDispatcher`).

### 5.1 `{ kind: 'sesion-cerrada', sesionId }`

1. En paralelo: `GET /inventarios/:sesionId` en CORE (trae `organizacionId`, `areaId`,
   `ubicacionId`, `fechaCierre`, `escaneos[]` con `resultado`/`codigoQr`/`observaciones` — sin
   `activoId`, ver 2.5) y `obtenerCatalogoCompleto(organizacionId)` (mismo método que usa 5.2,
   necesario para resolver el área esperada de cada `codigoQr` fuera de lugar).
2. Calcular veredicto con `agregacion/veredicto.ts` (puerto de
   `app-qr-sicsaft/src/lib/verdict.ts` — mismos 2 parámetros: cantidad de faltantes, cantidad de
   fuera de área) y upsert en `veredicto_sesion`.
3. Upsert en `control_area` (`area_id` de la sesión, `controlada_en_periodo = true`,
   `ultima_sesion_en = fechaCierre`).
4. Contador incremental de cobertura (evita recalcular desde cero en cada sesión cerrada): por
   cada escaneo con `resultado IN ('correcto','otra_area','otra_ubicacion')`, `INSERT INTO
   activo_escaneado_alguna_vez (codigo_qr, organizacion_id) VALUES (...) ON CONFLICT DO NOTHING`;
   `cobertura_organizacion.activos_escaneados` se actualiza a `COUNT(*) FROM
   activo_escaneado_alguna_vez WHERE organizacion_id = $1` en la misma transacción.
5. Filas de `activo_fuera_de_area`: por cada escaneo con `resultado IN ('otra_area',
   'otra_ubicacion')`, cruzar `codigoQr` contra el `Map` del catálogo (paso 1) para obtener
   `area_esperada_id` (`catalogo[codigoQr].areaId`); `area_real_id` es el `areaId` de la sesión
   (el operador escaneó ahí físicamente, DOC-017). Upsert por `codigoQr`.
6. Filas de `incidencia`: por cada escaneo con `resultado = 'con_incidencia'`, upsert por
   `(sesion_id, codigo_qr)` con `observaciones` (RF-06).

### 5.2 `{ kind: 'evento', eventoId, tipo, organizacionId }`

1. `GET /catalogo?organizacionId=` (paginado, iterar todas las páginas — volumen bajo en este MVP,
   mismo criterio que `ContratoRepository.findPagina`) para traer todos los activos de la
   organización con su `estado`/`catalogo.familia`/`areaId`.
2. Transacción: `DELETE FROM estado_activo_resumen WHERE organizacion_id = $1` +
   `INSERT` un `GROUP BY estado`; mismo patrón para `categoria_activo_resumen` (`GROUP BY area_id,
   familia`, más una fila agregada con `area_id = '(todas)'`).
3. Actualizar `cobertura_organizacion.activos_registrados` = `COUNT(*)` del catálogo recién leído;
   recalcular `porcentaje_cobertura` = `activos_escaneados / activos_registrados`.
4. `activo_no_localizado`: mismo patrón `DELETE FROM ... WHERE organizacion_id = $1` + `INSERT`
   de los `codigoQr` con `estado = 'extraviado'` en el catálogo recién leído — **sin condicionar
   por `tipo`** (a diferencia de un borrador anterior de este documento): `'extraviado'` no es un
   valor de `eventos.tipo` (DOC-005 6), así que no hay forma de saber por el tipo de evento si
   cambió; recalcularlo siempre en este handler es más simple y correcto que intentar adivinar
   cuándo hace falta.

### 5.3 Idempotencia del worker

BullMQ entrega **at-least-once** (`EventosOutboxDispatcher` puede reintentar un mensaje ya
publicado si el proceso murió antes de marcarlo, ARCHITECTURE.md 2). Todas las escrituras de
arriba son upserts o `DELETE`+`INSERT` completos por clave — reprocesar el mismo mensaje dos veces
dejando el mismo resultado final, no hace falta una tabla de deduplicación explícita.

### 5.4 Actualización de `sync_estado`

Al final de **cada** mensaje procesado (haya tocado agregados o no): `UPDATE sync_estado SET
ultimo_evento_procesado_en = now(), al_dia = true`. Un job separado (`@Interval`, mismo mecanismo
que `EventosOutboxDispatcher`) marca `al_dia = false` si pasaron más de
`CIP_UMBRAL_ATRASO_MINUTOS` (default 15, configurable — DOC-014 7.3) desde
`ultimo_evento_procesado_en` **y** hay mensajes esperando en la cola (`queue.getWaitingCount() >
0`) — si la cola está vacía, no hay nada atrasado, silencio no es lo mismo que atraso.

## 6. API de lectura

Todos los endpoints exigen `x-internal-service-token: ${CIP_SERVICE_TOKEN}` (3) y
`organizacionId` obligatorio por query param; devuelven `actualizadoEn`/`alDia` de `sync_estado`
en el body (RF-10). Los que devuelven listas aceptan `limit`/`offset` (default 20, tope 100 —
mismo contrato que `GET /catalogo`, RNF-02).

| Endpoint | RF | Filtros opcionales | Fuente |
|---|---|---|---|
| `GET /dashboard/cobertura` | RF-01 | — | `cobertura_organizacion` |
| `GET /dashboard/areas` | RF-02 | — | `control_area` |
| `GET /dashboard/sesiones` | RF-03 | `areaId` | `veredicto_sesion` (paginado) |
| `GET /dashboard/fuera-de-area` | RF-04 | `areaId` | `activo_fuera_de_area` (paginado) |
| `GET /dashboard/no-localizados` | RF-05 | — | `activo_no_localizado` (paginado) |
| `GET /dashboard/incidencias` | RF-06 | `codigoQr` | `incidencia` (paginado) |
| `GET /dashboard/estado-activos` | RF-07 | — | `estado_activo_resumen` |
| `GET /dashboard/categorias` | RF-09 | `areaId` | `categoria_activo_resumen` |

Drill-down de RF-08 (Sede→Área→Ubicación→Categoría→Activo): resuelto por composición de los
filtros de arriba (`areaId` ya cubre Área/Ubicación vía las tablas que lo indexan); "hasta
Activo" del último nivel remite a `GET /inventarios/:id` de CORE directamente (DOMAIN_MODEL.md 3
— no se duplica el detalle completo en CIP).

`GET /dashboard/incidencias` es la única tabla sin escritor identificado en 5 todavía — se llena
igual que `activo_fuera_de_area`, dentro del procesamiento de `sesion-cerrada` (5.1, un paso más:
upsert por cada escaneo con `resultado = 'con_incidencia'` de la sesión).

## 7. Docker / CI

- `cip/Dockerfile` — copia exacta de `core/Dockerfile` (mismo stack, mismo patrón multi-stage).
- `.github/workflows/cip-ci.yml` — copia de `core-ci.yml` con `working-directory: cip` y su propio
  servicio Postgres (`CIP_DB_*`); reusa el mismo servicio Redis efímero (ya lo necesita para el
  test del worker).
- `devops/local/docker-compose.yml`: `cip-migrate` (mismo patrón que `core-migrate`), `cip`
  (`CIP_DB_*`, `CORE_URL: http://core:3001`, `CORE_SERVICE_TOKEN` compartido, `CIP_SERVICE_TOKEN`
  nuevo, `REDIS_URL` compartido) — sin router de Traefik todavía (mismo criterio que `core`: sin
  consumidor externo real hasta que exista frontend).
- `devops/local/postgres/init/03-cip.sh` — mismo patrón que `02-core.sh`.
- `.env.example` — agrega `CIP_DB_USER`, `CIP_DB_PASSWORD`, `CIP_SERVICE_TOKEN`.

## 8. Orden de construcción sugerido

1. Migración `1755600000000` en CORE (2) — desbloquea todo lo demás, es la única pieza que toca
   código ya mergeado.
2. Esqueleto `cip/` + `DatabaseModule` + migraciones de agregados (3/4) — sin lógica de negocio
   todavía, solo que levante y migre.
3. `CoreClientService` (3) — copiar/adaptar el de CIS, con sus propios tests.
4. Worker (5) — la pieza más grande, TDD por tipo de mensaje.
5. API de lectura (6).
6. Docker/CI/compose (7) — verificación real de punta a punta, mismo criterio que el incremento 1
   (`docker build` + contenedor real + evento real disparado desde CORE llegando a un agregado
   consultable por la API).

## 9. Documentos relacionados

[DOC-014](DOC-014-cip-dashboard.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[DOMAIN_MODEL.md](DOMAIN_MODEL.md), `core/src/eventos-outbox/` (ya mergeado, PR #8),
`app-qr-sicsaft/src/lib/verdict.ts` (fuente del puerto de veredicto).

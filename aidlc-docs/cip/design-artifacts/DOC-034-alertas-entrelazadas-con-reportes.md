# DOC-034 — Plan unificado: Alertas entrelazadas con reportes + Historial nocturno del CIP

**Fecha**: 2026-09-15 · **Fase**: Construction (incremento sobre DOC-026 8, que dejaba el Motor
de Alertas fuera de alcance) · **Pedido por**: usuario, sesión 2026-09-14/15.

Este documento une en un solo plan dos pedidos separados de la misma sesión, ambos sobre el CIP:

- **Parte A** — las alertas de AFT fuera de lugar deben quedar entrelazadas al reporte (sesión de
  control) que las generó, siguiendo la misma regla de veredicto que ese reporte.
- **Parte B** — "Controles" necesita una pestaña tipo dashboard/resumen **con historial**, que se
  genere siempre a las 12 de la noche (pedido original de esta sesión, 2026-09-14, sin retomar
  hasta ahora).

Van en el mismo documento porque las dos tocan la misma pieza de infraestructura (el worker de
agregación de CIP, ADR-005) y porque un "Historial" del CIP sin las alertas entrelazadas a su
sesión de origen sería una fuente de verdad a medias — conviene implementarlas juntas.

## Parte A — Alertas entrelazadas con el reporte de origen

### 1. Contexto

La pestaña **Alertas** del CIP (`core/frontend/src/pages/cip/AlertasTab.tsx`, agregada
2026-09-14) lista los AFT detectados fuera de su área durante una acción de control, leyendo
`GET /dashboard/fuera-de-area` (CIS→CIP). El dato viene de la tabla `activo_fuera_de_area`
(`cip/migrations/1755700000000_schema-agregados.ts`), poblada por
`AgregacionService.procesarSesionCerrada()` cada vez que CORE cierra una sesión de control
(`sesion-cerrada` en la cola `cip-eventos`).

El usuario pidió (2026-09-14, re-confirmado 2026-09-15) que **las alertas queden entrelazadas a
los reportes** (las sesiones de control, RF-I / "Pantalla 8") y que **seguán la misma regla de
veredicto que los reportes** — sin cambiar cómo se ven hoy más allá de eso.

### 2. Regla de veredicto — verificada, sin cambios de lógica

Confirmado contra el código actual (2026-09-15): las tres implementaciones independientes de la
regla (`app-qr-sicsaft/src/lib/verdict.ts`, `core/src/inventarios/veredicto.ts`,
`cip/src/agregacion/veredicto.ts` — independientes a propósito, ARCHITECTURE.md 5) ya calculan
exactamente lo pedido:

- **Exitoso**: no falta ningún AFT esperado y no apareció ningún AFT de otra área/ubicación.
- **Aceptable**: no faltan AFT del área, pero aparecieron AFT de otras áreas.
- **Defectuoso**: faltan AFT — solos, o junto con AFT de otras áreas.

Este incremento **no toca esa lógica**. Lo que falta es que el veredicto de la sesión (ya
calculado una vez por `AgregacionService` en `veredicto_sesion`) viaje también hasta cada alerta
de esa sesión, en vez de recalcularse o vivir desconectado.

### 3. El gap real (por qué "no están entrelazadas" hoy)

`activo_fuera_de_area` (schema actual):

```
codigo_qr        text PRIMARY KEY
organizacion_id  text NOT NULL
area_real_id     text NOT NULL
area_esperada_id text NOT NULL
detectado_en     timestamptz
```

Dos problemas concretos:

1. **No guarda `sesion_id`.** No hay forma de ir de una alerta al reporte (sesión) que la generó
   — ni de mostrar el veredicto de esa sesión junto a la alerta.
2. **`codigo_qr` es la PK.** Un `UPSERT ... ON CONFLICT (codigo_qr)` pisa el registro anterior: si
   el mismo AFT aparece fuera de área en dos sesiones distintas, solo sobrevive la más reciente.
   Esto ya rompe la trazabilidad histórica incluso sin pensar en "entrelazar con reportes".

`veredicto_sesion` (el reporte) sí existe y ya tiene todo lo necesario: `sesion_id` (PK),
`area_id`, `veredicto`, `fecha_cierre`. El patrón para vincular una tabla de detalle a una sesión
ya existe en el propio código — `incidencia` usa exactamente `(sesion_id, codigo_qr)` como PK
compuesta (`agregacion.repository.ts` `upsertIncidencia`). Este incremento replica ese patrón en
`activo_fuera_de_area`.

Punto clave de diseño: `AgregacionService.procesarSesionCerrada()` **ya calcula el veredicto de la
sesión** (línea `const veredicto = calcularVeredicto(...)`) **antes** del loop que inserta cada
`activo_fuera_de_area` de esa misma sesión. No hace falta un JOIN en el momento de lectura del
dashboard ni recalcular nada: alcanza con pasar `sesion.id` y `veredicto` (ya en memoria) al
`upsertFueraDeArea` de cada fila, en el mismo commit lógico que ya escribe `veredicto_sesion`.

### 4. Cambios de diseño

#### 4.1 Esquema (`cip/migrations/`, migración nueva)

```
ALTER TABLE activo_fuera_de_area
  ADD COLUMN sesion_id text NOT NULL,
  ADD COLUMN veredicto text NOT NULL
    CHECK (veredicto IN ('exitoso','aceptable','defectuoso'));

ALTER TABLE activo_fuera_de_area DROP CONSTRAINT activo_fuera_de_area_pkey;
ALTER TABLE activo_fuera_de_area ADD PRIMARY KEY (sesion_id, codigo_qr);
```

`sesion_id`/`veredicto` sin default: una migración "up" sobre una tabla ya poblada en un ambiente
real necesitaría backfill o `ALTER ... ADD COLUMN ... NOT NULL DEFAULT` con un valor de relleno
inicial. Dado que hoy no hay ningún ambiente productivo con filas reales en esta tabla (Nivel 2 es
reciente, ver README de `cip/`), se agrega directo `NOT NULL` sin default — si en la migración
`down()` hace falta revertir, vuelve a la forma anterior sin pérdida de datos reales.

#### 4.2 Backend CIP

- `agregacion.repository.ts` `upsertFueraDeArea(input)`: agrega `sesionId: string` y
  `veredicto: Veredicto` a `input`; el `INSERT`/`ON CONFLICT` pasa a `(sesion_id, codigo_qr)`
  (mismo patrón que `upsertIncidencia`).
- `agregacion.service.ts` `procesarSesionCerrada()`: el loop de `fueraDeArea` pasa
  `sesionId: sesion.id` y `veredicto` (la constante ya calculada arriba) a `upsertFueraDeArea`.
- `dashboard.types.ts` `FueraDeAreaResponse`: agrega `sesionId: string` y `veredicto: string`.
- `dashboard.repository.ts` `listarFueraDeArea()`: el `SELECT` agrega `sesion_id, veredicto` y el
  mapeo de la respuesta los expone.

#### 4.3 `core/frontend`

- `dashboard-client.ts` `ActivoFueraDeArea`: agrega `sesionId: string` y `veredicto: string`.
- `AlertasTab.tsx`: cada alerta muestra el veredicto de su sesión de origen (mismo estilo de badge
  que `ResumenTab.tsx` usa para Excelente/Aceptable/Deficiente — reusa la paleta ya establecida,
  no inventa una nueva) y un enlace **"Ver reporte completo"** que navega a
  `/dashboard/controles-area?organizacionId=<org>&sesionId=<sesionId>`. La estructura de la
  pantalla (lista de tarjetas, "Está en" / "Debería estar en") **no cambia** — el usuario pidió
  mantenerla así, solo sumarle el entrelazado.
- `ControlesAreaTab.tsx`: hoy preselecciona automáticamente la primera sesión de la lista
  (`data[0].id`). Se agrega: si la URL trae `?sesionId=`, esa es la selección inicial en vez de la
  primera — así el link de Alertas realmente "entra" al reporte correcto, no solo a la pestaña.

#### 4.4 Qué NO cambia en este incremento

- La regla de veredicto en sí (§2) — cero cambios de lógica, ya está correcta en los tres
  desplegables.
- El layout/diseño visual de `AlertasTab.tsx` — se le suma el badge de veredicto y el link, nada
  más se reordena o rediseña.
- `activo_no_localizado` (AFT faltantes) e `incidencia` — mismo problema de fondo podrían tenerlo
  a futuro, pero no fueron parte del pedido; queda fuera de este incremento (YAGNI, mismo criterio
  que DOC-026 8).

### 5. Depende de (Parte A)

[DOC-018](DOC-018-cip-servicio-nestjs.md) (arquitectura de agregación, tabla `incidencia` como
precedente del patrón `(sesion_id, codigo_qr)`) y [DOC-026 8](DOC-026-cip-inteligencia-decisional.md)
(donde se dejó constancia de que el Motor de Alertas quedaba diferido).

## Parte B — Historial nocturno de "Controles de área"

### 1. Contexto y pedido original

Pedido literal (2026-09-14): *"quiero que los controles tenga una pestaña tipo dashboard como
resumen que se realice siempre a las 12 de la noche con historial"*. Interpretación: una nueva
vista del CIP tipo "Historial" — una serie de cortes diarios (cuántas sesiones exitosas/
aceptables/defectuosas hubo cada día), generada automáticamente cada medianoche, no calculada al
vuelo cada vez que alguien abre la pantalla.

`ResumenTab.tsx` ya muestra "Total Acciones Control Día/Acumulada por veredicto"
(`GET /dashboard/veredictos`), pero son **totales en tiempo real** (hoy vs. siempre), sin cortes
por día ni serie histórica navegable — no cubre el pedido de "con historial".

### 2. Por qué a medianoche y no al vuelo

`veredicto_sesion` ya tiene una fila por sesión con `fecha_cierre` — técnicamente se podría agrupar
por día en el momento de la lectura (`GROUP BY date_trunc('day', fecha_cierre)`) sin ningún job
nuevo. Se descarta esa opción porque el usuario pidió explícitamente el corte a medianoche, y
porque agregar sobre *todo* el historial de sesiones en cada carga de pantalla no escala a medida
que pasan los meses — un corte diario pre-calculado sí.

### 3. Infraestructura ya disponible

CIP ya tiene un cliente pg-boss propio (ADR-005, `CIP_EVENTOS_PGBOSS`,
`agregacion/create-pgboss-client.ts`), usado hoy solo para consumir la cola `cip-eventos`. pg-boss
soporta jobs programados de forma nativa (`boss.schedule(queue, cronExpression, data, options)`)
— no hace falta sumar ninguna librería nueva (`node-cron`, etc.), alcanza con registrar un
schedule más sobre el mismo cliente.

**Detalle real a no pasar por alto**: pg-boss interpreta el cron en UTC salvo que se pase
`options.tz` explícito. "Medianoche" tiene que ser medianoche **de Chile**
(`America/Santiago`), no medianoche UTC (que cae a las 20:00 o 21:00 en Chile según horario de
verano) — el schedule se registra como `boss.schedule('cip-resumen-diario', '0 0 * * *', {}, { tz:
'America/Santiago' })`.

### 4. Esquema nuevo

```
CREATE TABLE resumen_diario (
  organizacion_id text NOT NULL,
  fecha           date NOT NULL,        -- el día que resume (calendario Chile)
  total_sesiones  integer NOT NULL DEFAULT 0,
  exitoso         integer NOT NULL DEFAULT 0,
  aceptable       integer NOT NULL DEFAULT 0,
  defectuoso      integer NOT NULL DEFAULT 0,
  generado_en     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacion_id, fecha)
);
CREATE INDEX ON resumen_diario (organizacion_id, fecha DESC);
```

`PRIMARY KEY (organizacion_id, fecha)` con upsert (no `INSERT` puro): si el job se reintenta (pg-
boss, at-least-once) o se corre manualmente para reprocesar un día, no duplica filas.

### 5. Job y worker nuevos (`cip/src/agregacion/`)

- `AgregacionModule` registra el schedule al arrancar (`onModuleInit` o similar), igual que hoy
  registra el consumidor de `cip-eventos`.
- Nuevo handler `ResumenDiarioWorker` (mismo directorio, mismo patrón que
  `EventosOutboxWorker`/`SyncEstadoWatcher`) que al recibir el job:
  1. Recorre las organizaciones conocidas (`cobertura_organizacion` ya tiene una fila por
     organización — no hace falta una tabla de organizaciones nueva en CIP).
  2. Para cada una, cuenta `veredicto_sesion` agrupado por `veredicto` donde
     `fecha_cierre::date = (ayer, huso Chile)`.
  3. Upsertea la fila del día en `resumen_diario` (nuevo método
     `AgregacionRepository.upsertResumenDiario`).
- Idempotente por diseño (mismo criterio que el resto de `AgregacionRepository`, ver comentario en
  `agregacion.service.ts` sobre reintentos): reprocesar el mismo día pisa la fila existente, no la
  duplica.

### 6. API (`cip/src/dashboard/`, `cis/`, `core/frontend`)

- Nuevo `GET /dashboard/historico?organizacionId=&desde=&hasta=` en CIP, paginado como el resto de
  `dashboard.controller.ts` — devuelve la lista de filas de `resumen_diario` en el rango.
- CIS agrega el proxy (mismo patrón que el resto de `/dashboard/*`, `dashboard-connector`).
- `core/frontend/src/lib/dashboard-client.ts` agrega `getHistorico(organizacionId, desde?, hasta?)`
  y el tipo `ResumenDiario { fecha, totalSesiones, exitoso, aceptable, defectuoso }`.

### 7. UI — "Historial" como sub-vista de Controles de área (confirmado 2026-09-15)

**No** va como pestaña nueva del sidebar. `ControlesAreaTab.tsx` ya tiene un toggle interno
("Control BPI (Pantalla 8)" / "Escaneos", estado local `vistaDetalle`) — se agrega un tercer
valor a ese mismo toggle:

- `vistaDetalle: 'control' | 'escaneos' | 'historial'` (antes solo los dos primeros).
- Botón nuevo "Historial" junto a los otros dos, mismo estilo (`Button variant={vistaDetalle ===
  'historial' ? 'primary' : 'secondary'}`).
- Al seleccionarlo, se muestra un componente nuevo `HistorialSesiones.tsx` (mismo directorio
  `pages/cip/`, no un `*Tab.tsx` — no es una ruta ni una pestaña del sidebar, es una vista más
  dentro de `ControlesAreaTab`) con:
  - Tabla o gráfico de barras apiladas por día (Exitoso/Aceptable/Defectuoso, misma paleta que
    `ResumenTab.tsx` — verde/amarillo/rojo), más reciente primero.
  - Selector de rango (últimos 7/30 días — mismo componente `PERIODOS` que `ResumenTab.tsx` ya
    define, hoy sin conectar a datos reales; acá sí se conecta).
- No se toca el sidebar (`AppShell.tsx` sigue con las mismas 4 entradas del CIP:
  Resumen/Activos/Controles de área/Alertas).

### 8. Qué NO se hace en este incremento

- No se dispara el corte diario para organizaciones sin ninguna sesión ese día — no genera filas
  en 0 (`total_sesiones = 0`) para no ensuciar `resumen_diario` con ruido; `HistorialSesiones.tsx`
  muestra "sin datos" para los días sin fila.
- No hay recálculo retroactivo automático de días pasados a la primera corrida — el historial
  empieza a acumularse desde que este incremento se despliega. Un backfill manual (correr el job
  una vez por cada día pasado) queda fuera de alcance salvo que se pida explícitamente.
- No reemplaza los KPI en tiempo real de `ResumenTab.tsx` — son cosas distintas (hoy/acumulado en
  vivo vs. serie histórica por corte diario).

## Plan de implementación unificado (orden) — aprobado 2026-09-15

**Parte A:**
1. Migración `activo_fuera_de_area` (Parte A §4.1).
2. `agregacion.repository.ts`/`agregacion.service.ts` + specs (Parte A §4.2).
3. `dashboard.types.ts`/`dashboard.repository.ts` + specs (Parte A §4.2).
4. `dashboard-client.ts`, `AlertasTab.tsx`, `ControlesAreaTab.tsx` (Parte A §4.3).

**Parte B:**
5. Migración `resumen_diario` (Parte B §4).
6. `ResumenDiarioWorker` + registro del schedule + `AgregacionRepository.upsertResumenDiario` +
   specs (Parte B §5).
7. `GET /dashboard/historico` en CIP + proxy en CIS (Parte B §6).
8. `dashboard-client.ts` (`getHistorico`), `HistorialSesiones.tsx`, toggle nuevo dentro de
   `ControlesAreaTab.tsx` (Parte B §7) — sin tocar `AppShell.tsx`.

**Verificación (ambas partes):**
9. `bun run test` + `bun run test:e2e` en `cip/` y `core/` (Postgres real); `bun run test` +
   `lint:ci` + `build` en `core/frontend/`; verificación visual en navegador (link Alertas →
   Controles de área; toggle a Historial; datos del corte diario con fecha simulada).

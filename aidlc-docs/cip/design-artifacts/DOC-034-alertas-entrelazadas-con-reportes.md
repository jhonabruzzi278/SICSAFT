# DOC-034 — Alertas del CIP entrelazadas con el reporte de origen

**Fecha**: 2026-09-15 · **Fase**: Construction (incremento sobre DOC-026 8, que dejaba el Motor
de Alertas fuera de alcance) · **Pedido por**: usuario, sesión 2026-09-14/15.

## 1. Contexto

La pestaña **Alertas** del CIP (`core/frontend/src/pages/cip/AlertasTab.tsx`, agregada
2026-09-14) lista los AFT detectados fuera de su área durante una acción de control, leyendo
`GET /dashboard/fuera-de-area` (CIS→CIP). El dato viene de la tabla `activo_fuera_de_area`
(`cip/migrations/1755700000000_schema-agregados.ts`), poblada por
`AgregacionService.procesarSesionCerrada()` cada vez que CORE cierra una sesión de control
(`sesion-cerrada` en la cola `cip-eventos`).

El usuario pidió (2026-09-14, re-confirmado 2026-09-15) que **las alertas queden entrelazadas a
los reportes** (las sesiones de control, RF-I / "Pantalla 8") y que **seguán la misma regla de
veredicto que los reportes** — sin cambiar cómo se ven hoy más allá de eso.

## 2. Regla de veredicto — verificada, sin cambios de lógica

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

## 3. El gap real (por qué "no están entrelazadas" hoy)

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

## 4. Cambios de diseño

### 4.1 Esquema (`cip/migrations/`, migración nueva)

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

### 4.2 Backend CIP

- `agregacion.repository.ts` `upsertFueraDeArea(input)`: agrega `sesionId: string` y
  `veredicto: Veredicto` a `input`; el `INSERT`/`ON CONFLICT` pasa a `(sesion_id, codigo_qr)`
  (mismo patrón que `upsertIncidencia`).
- `agregacion.service.ts` `procesarSesionCerrada()`: el loop de `fueraDeArea` pasa
  `sesionId: sesion.id` y `veredicto` (la constante ya calculada arriba) a `upsertFueraDeArea`.
- `dashboard.types.ts` `FueraDeAreaResponse`: agrega `sesionId: string` y `veredicto: string`.
- `dashboard.repository.ts` `listarFueraDeArea()`: el `SELECT` agrega `sesion_id, veredicto` y el
  mapeo de la respuesta los expone.

### 4.3 `core/frontend`

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

### 4.4 Qué NO cambia en este incremento

- La regla de veredicto en sí (§2) — cero cambios de lógica, ya está correcta en los tres
  desplegables.
- El layout/diseño visual de `AlertasTab.tsx` — se le suma el badge de veredicto y el link, nada
  más se reordena o rediseña.
- `activo_no_localizado` (AFT faltantes) e `incidencia` — mismo problema de fondo podrían tenerlo
  a futuro, pero no fueron parte del pedido; queda fuera de este incremento (YAGNI, mismo criterio
  que DOC-026 8).

## 5. Plan de implementación (orden)

1. Migración `cip/migrations/<timestamp>_alertas-entrelazadas-con-reportes.ts` (§4.1).
2. `cip/src/agregacion/agregacion.repository.ts` + su spec.
3. `cip/src/agregacion/agregacion.service.ts` + su spec (verificar que el test de
   "aceptable"/"defectuoso" ahora también asegura `sesionId`/`veredicto` en `upsertFueraDeArea`).
4. `cip/src/dashboard/dashboard.types.ts` + `dashboard.repository.ts` + su spec.
5. `core/frontend/src/lib/dashboard-client.ts` (tipo `ActivoFueraDeArea`).
6. `core/frontend/src/pages/cip/AlertasTab.tsx` (badge de veredicto + link al reporte).
7. `core/frontend/src/pages/cip/ControlesAreaTab.tsx` (preselección por `?sesionId=`).
8. `bun run test` + `bun run test:e2e` en `cip/` y `core/` (Postgres real vía Testcontainers-style
   service, igual que el resto del e2e de `core/`); `bun run test` + `lint:ci` + `build` en
   `core/frontend/`; verificación visual en navegador del link Alertas → Controles de área.

## 6. Depende de

[DOC-018](DOC-018-cip-servicio-nestjs.md) (arquitectura de agregación, tabla `incidencia` como
precedente del patrón `(sesion_id, codigo_qr)`) y [DOC-026 8](DOC-026-cip-inteligencia-decisional.md)
(donde se dejó constancia de que el Motor de Alertas quedaba diferido).

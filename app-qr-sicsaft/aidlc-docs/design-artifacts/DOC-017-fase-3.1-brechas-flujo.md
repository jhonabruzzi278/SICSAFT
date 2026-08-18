# DOC-017 — Fase 3.1: brechas de flujo APP QR encontradas en el spec funcional (pptx)

> Diseño antes que código (`CLAUDE.md` Metodología AI-DLC). Este documento cubre Inception para
> los 4 ítems de `ROADMAP.md` Fase 3.1. **Estado 2026-08-17**: los 4 ítems confirmados con el
> usuario, listos para Construction — sin preguntas abiertas.

## 0. Origen y alcance

Fuente: `PROCESO MODULAR DE APLICACION SICSAFT, SOFTWARE.ppt` (fuera de git, revisado
2026-08-17), comparado contra el código real de `app-qr-sicsaft/` y `core/`. Detalle de cada ítem
y su estado: [`REQUISITOS.md`](../../../REQUISITOS.md) "Requisitos nuevos identificados en spec
funcional (pptx)". Plan de fase: [`ROADMAP.md`](../../../ROADMAP.md) Fase 3.1.

Cuatro ítems, ninguno requiere tocar CIS o el contrato DOC-006 (API CIS↔CORE) — los tres primeros
son puramente de cliente (APP QR), el cuarto depende de una decisión de modelo en
`base-patrimonial/DOC-005-modelo-patrimonial.md`.

## 1. Selector de modo 1/2/3 (pantalla 2 del pptx)

**Qué pide el pptx**: pantalla previa al control donde el operador elige Modo 1 (QR), Modo 2
(QR+WEB) o Modo 3 (QR+WEB+RFID).

**Lectura del código real**: WEB (Fase 5) y RFID (Fase 8, no iniciada) son sistemas aparte, no
ramas de comportamiento dentro de APP QR — el escaneo QR de Modo 1 y Modo 2 es exactamente el
mismo código hoy (`ScanPage.tsx`), la única diferencia es si la organización *también* tiene el
portal WEB desplegado para consultar los datos después. No hay nada que "activar/desactivar" en
el escaneo en sí al elegir Modo 2 en vez de Modo 1.

**Diseño propuesto**: pantalla **informativa**, no una máquina de estados con comportamiento
distinto por modo:
- Modo 1 y Modo 2 quedan siempre habilitados y llevan al mismo flujo de escaneo existente — Modo
  2 solo agrega un aviso ("los datos de este control quedarán disponibles en el portal WEB de tu
  organización") sin cambiar código de escaneo.
- Modo 3 aparece **deshabilitado** ("próximamente — requiere hardware RFID") hasta que exista
  Fase 8. Mostrarlo mejor que ocultarlo: el pptx es un compromiso de producto ya comunicado, y
  ocultarlo sin explicación generaría la pregunta "¿dónde quedó el modo 3?" en vez de una
  respuesta clara de estado.
- La selección se guarda en el mismo `localStorage` que ya persiste el operador
  (`qrvault-operator`), como preferencia de UI — no se propaga a CIS/CORE, no es parte del
  contrato DOC-006 (no hay razón de negocio para que el backend sepa qué modo se mostró).

**Por qué no más que esto (YAGNI)**: construir branching real de comportamiento por modo sin que
Modo 3 exista todavía sería anticipar una API que no está diseñada (Fase 8). Si en el futuro Modo 2
necesita comportamiento distinto de Modo 1 (no lo necesita hoy), se agrega cuando aparezca ese
requisito concreto.

## 2. Declaración de resultado de sesión: EXITOSO / ACEPTABLE / DEFECTUOSO

**Qué pide el pptx** (texto original, parcialmente ambiguo — ver interpretación abajo):
> "DECLARACION DEL PROCESO: EXITOSO (TODOS LOS AFT SON DEL AREA Y SE SCANNEARON EN EL CONTROL),
> ACEPTABLES (LOS AFT SCANNEADOS SON DEL AREA, PERO TAMBIEN EXISTEN OTROS AFT QUE CORRESPONDEN AL
> AREA [faltantes], DECLARAR LOS AFT QUE NO SON DEL AREA Y ESPECIFICAR A QUE AREA PERTENECEN),
> DEFECTUOSO (EXISTEN AFT AUSENTES EN EL CONTROL DEL AREA Y ADEMAS EXISTEN AFT QUE SON DE OTRAS
> AREAS)"

**Interpretación propuesta** (a partir de las 2 señales que ya se cuentan en `ScanPage.tsx`:
`missingAssets.length` y `outOfPlaceCount` = `wrongAreaCount + wrongLocationCount`):

| Veredicto | Condición | Lectura de negocio |
|---|---|---|
| **EXITOSO** | `missingAssets.length === 0 && outOfPlaceCount === 0` | Todo lo esperado del área se escaneó, nada de otra área apareció acá |
| **ACEPTABLE** | Exactamente uno de los dos es `> 0` (faltan activos **o** aparecieron de otra área, no ambos) | Un solo tipo de discrepancia, declarada en el informe |
| **DEFECTUOSO** | `missingAssets.length > 0 && outOfPlaceCount > 0` | Ambos problemas a la vez — control incompleto y contaminado |

**Diseño propuesto**: se calcula **en el cliente**, en `ScanPage.tsx`, a partir de contadores que
ya existen — no requiere cambio de contrato con CORE ni nuevo endpoint. Es un campo derivado para
mostrar en el resumen visual antes de "Confirmar y enviar" (mismo lugar donde ya se muestran
`report-expected`/`report-missing`/`correctCount`). Si más adelante CIP (Fase 6) necesita este
veredicto para el informe diario agregado, se recalcula ahí con la misma regla — no hace falta que
APP QR se lo mande a CORE todavía (sin consumidor real en backend hoy, YAGNI).

**Riesgo declarado**: la interpretación de la tabla es mi lectura del texto del pptx, que en la
frase de ACEPTABLE mezcla dos ideas en una oración sin puntuación clara. **Confirmado correcto
por el usuario 2026-08-17** — ver 7.

## 3. Estado del AFT declarado durante el control (en servicio/mantenimiento/inactivo/baja)

**Qué pide el pptx**: el controlador marca el estado de cada AFT escaneado durante el control.

**Resuelto 2026-08-17** (confirmado con el usuario — DOC-005 reabierto):
`base-patrimonial/DOC-005-modelo-patrimonial.md` 4 ahora modela `activo | en_transito |
extraviado | mantenimiento | inactivo | dado_de_baja` para `Activo`, con
`activo ⇄ mantenimiento` y `activo ⇄ inactivo` nuevas. "En servicio" del pptx mapea a `activo`
(ya existía, no-op).

**Quién puede declarar qué** (`seguridad/DOC-012-administrador-patrimonial.md` 5.1):
- **`mantenimiento`/`inactivo`/`activo`** → **cualquier operador de APP QR, sin rol nuevo**. Tomo
  III 1.4 ya le concede a APP QR "registro de inventarios/**estados**" — es una extensión del
  payload de `POST /inventarios` (campo `estadoDeclarado` por escaneo), no un endpoint nuevo ni
  una autorización nueva.
- **`dado_de_baja`** → **sigue exclusivo de Administrador Patrimonial**, sin cambios.

**Resuelto 2026-08-17** (confirmado con el usuario): el operador **sugiere** la baja, no la
ejecuta — sin tocar `Activo.estado`. Es un campo `bajaSugerida?: { motivo: string }` por escaneo,
que viaja en el mismo `POST /inventarios` extendido de arriba (junto a `estadoDeclarado`) como
dato informativo del inventario/evento, no como transición de estado — CORE lo guarda igual que
hoy guarda una incidencia u observación, sin invocar `verificarRolAdministradorPatrimonial` ni
ninguna lógica de escritura oficial. El Administrador Patrimonial revisa las sugerencias al leer
el informe (mismo lugar donde ya revisa inventarios/auditoría) y, si corresponde, ejecuta la baja
real él mismo desde WEB con `POST /activos/:id/baja` (ya implementado, Fase 4) — la Base
Patrimonial nunca se modifica sin que ese rol la ejecute explícitamente.

**Por qué esto ya no choca con el tomo**: Tomo III 1.4 solo prohíbe que APP QR *modifique* la
Base Patrimonial Oficial — una sugerencia que no cambia ningún estado, ni siquiera
`Activo.estado`, no es una modificación. Es el mismo tipo de dato que "generación de informes",
que el tomo sí le concede a APP QR explícitamente. No hay conflicto que resolver ni pregunta
abierta: los 4 ítems de Fase 3.1 quedan confirmados y listos para Construction.

## 4. Lista de AFT fuera de área con su área real

**Qué pide el pptx**: agregar en el informe la lista "estos AFT no son de esta área, y son de la
Área X".

**Lectura del código real**: el dato ya existe completo — `ScanResolution.expectedAreaName` /
`expectedLocationName` (`app-qr-sicsaft/src/lib/scan-resolve.ts`) ya resuelve a qué área/ubicación
pertenece un activo fuera de lugar, y ya se usa para el toast (`⚠ ${code} — otra área
(${resolution.expectedAreaName})`). Falta únicamente agregar una sección en el resumen de
`ScanPage.tsx` (al lado de "Activos faltantes") que liste los ítems con `category === 'wrong-area'`
agrupados por `expectedAreaName`.

**Diseño propuesto**: sin cambios de datos ni de contrato — es una vista nueva sobre datos que ya
llegan al cliente. El único ítem de los 4 sin pregunta abierta (7); puede construirse
independiente de que se resuelvan los ítems 1–3.

## 5. Qué NO resuelve este documento

- **UI para que el Administrador Patrimonial revise "bajas sugeridas"** — este incremento entrega
  el dato (`bajaSugerida.motivo` guardado junto al inventario); una bandeja dedicada de
  "sugerencias pendientes" en WEB (en vez de revisarlas leyendo el detalle del inventario/informe,
  ya disponible) es una mejora de UX sin consumidor confirmado todavía — se agrega si hace falta,
  no de entrada (YAGNI).
- RFID real (Modo 3) — Fase 8, hardware no disponible.
- Migración real de la constraint `estado IN (...)` de `activos` (aditiva, sin escribir todavía —
  ver DOC-005 8) ni la extensión real del payload `POST /inventarios`/DOC-006 (sin código hasta
  cerrar Construction).
- Cualquier otro cambio al contrato DOC-006 fuera del campo `estadoDeclarado` — los 4 ítems son de
  cliente, cálculo derivado, o extensión aditiva de un endpoint ya existente; ninguno necesita un
  endpoint nuevo.

## 6. Testing

- Selector de modo: test de UI verificando que Modo 3 está deshabilitado y Modo 1/2 llevan al
  mismo `ScanPage`.
- Veredicto de sesión: unit tests puros sobre la función de cálculo (tabla de verdad de 2 con
  `missingAssets.length`/`outOfPlaceCount` en 0, uno, o ambos > 0) — mismo patrón que
  `scan-resolve.spec.ts` ya usa para las categorías existentes.
- Registro de estado operativo (`mantenimiento`/`inactivo`/`activo`): unit en CORE sobre la nueva
  transición (`ActivoRepository`), e2e verificando que **no** requiere el claim de rol
  (a diferencia de `activo-escritura.e2e-spec.ts`, que sí lo exige para baja/alta/reincorporación)
  — caso explícito de "operador sin rol declara mantenimiento con éxito" para no regresionar el
  límite de autorización si alguien copia el guard equivocado más adelante.
- Lista de AFT fuera de área: test de UI verificando agrupación por `expectedAreaName` con datos
  de `wrong-area` ya presentes en `ScanPage.spec` (si existe) o Playwright.
- Baja sugerida: unit verificando que `bajaSugerida` viaja en el payload de `POST /inventarios`
  sin invocar ninguna transición de `Activo.estado` ni el guard de rol — caso explícito de
  regresión para que nadie lo confunda más adelante con una escritura oficial.

## 7. Preguntas abiertas — ninguna, todo confirmado

**Resuelto 2026-08-17, confirmado con el usuario**:
- 1 selector de modo — informativo, Modo 3 deshabilitado hasta Fase 8 (opción recomendada).
- 2 tabla EXITOSO/ACEPTABLE/DEFECTUOSO — interpretación confirmada correcta.
- 3 estados mantenimiento/inactivo — DOC-005 reabierto y modelado; autorización resuelta vía
  Tomo III 1.4 sin rol nuevo, ver DOC-012 5.1.
- 3 baja — el operador la sugiere (dato informativo, sin tocar `Activo.estado`), el Administrador
  Patrimonial la ejecuta desde WEB tras revisar — sin conflicto con el tomo, ver DOC-012 5.1.

Los 4 ítems pasan a Construction.

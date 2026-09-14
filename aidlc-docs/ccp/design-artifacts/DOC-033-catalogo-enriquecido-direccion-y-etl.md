# DOC-033 — Catálogo de Activos enriquecido en CCP + Dirección + ETL ampliado

> Diseño antes que código (`CLAUDE.md` Metodología AI-DLC). Toca CORE→CIS→CCP→APP QR→ETL — mismo
> patrón multi-capa de DOC-021, documentado acá porque la decisión de diseño nace del catálogo de
> CCP.

## 0. Origen y alcance

Pedido directo del usuario (2026-09-11), con dos capturas de referencia:

1. Encabezado de tabla deseado para "Catálogo de Activos" en CCP:
   `No | DIRECCION | CODIGO | NOMBRE AFT | CATEGORIA | ESTADO | AREA | MARCA | MODELO | SERIE |
   FECHA COMPRA | VALOR.CLP. | RESPONSABLE`
2. Una tabla de referencia "Tipo_Cliente" mostrando que distintos rubros (Municipal, Educación,
   Salud, Retail, Industrial, ...) nombran su nivel intermedio de forma distinta (Dirección,
   Gerencia, Planta, Sucursal...) pero siempre como **un solo nivel** entre Organización y Área.

**Decisión de alcance confirmada con el usuario** (`AskUserQuestion`): la tabla de tipos de
cliente es *referencia*, no un pedido de árbol N-niveles configurable. Se resuelve reusando
"Dirección" tal como ya se diseñó para DOC-006/APP QR en la sesión previa — `areas.dependencia`,
texto libre, sin tabla nueva. Un cliente Industrial escribe "Planta" en esa misma columna; el
sistema no cambia. Se descarta explícitamente construir un árbol dinámico de niveles — sería un
rediseño de esquema completo, no una extensión.

## 1. Estado real relevado (por qué esto toca 4 sistemas)

- **`GET /catalogo`** (CORE→CIS, un único endpoint que usan tanto APP QR como CCP —
  `qr-connector` module) devuelve `ActivoCatalogo` con: `id, codigoQr, nombre, familia,
  organizacionId, areaId, ubicacionId, areaNombre, ubicacionNombre, incorporadoEn, estado`. Le
  faltan: `areaDependencia` (Dirección), `marca`, `modelo`, `serie`, `valorPatrimonial`,
  `fechaCompra`, `responsableNombre`. `familia` ya sirve como "Categoría" — no hace falta un campo
  nuevo para eso.
- **`activos.fecha_alta`** (`SELECT_ACTIVO_SQL`, `activo.repository.ts`) es "cuándo el bien entró
  a la BPI" (`CURRENT_DATE` fijo en el INSERT), un concepto distinto de "Fecha de compra" que trae
  el Excel del contador. No hay columna hoy para eso — se agrega `fecha_compra` (nullable, no
  reemplaza `fecha_alta`).
- **`catalogo_activos.marca`/`modelo`** ya existen en el esquema (usados solo por el alta manual
  de CCP, "Nuevo Tipo de Catálogo") pero el ETL nunca los completa — `resolvedor-importacion.
  service.ts` resuelve categoría (`tipo`/`familia`) e ignora Marca/Modelo del Excel por completo.
- **El mapeo del ETL** (`mapeo-ejemplo.json`) ya soporta `DIRECCION→direccionNombre`,
  `AREA→areaNombre`, `RESPONSABLE→responsableNombre`, `CATEGORIA→categoriaNombre`,
  `NOMBRE AFT→nombreAft`, `SERIE→serie`, `VALOR.CLP.→valorPatrimonial` — 7 de las 12 columnas
  pedidas ya llegan de punta a punta. Faltan `MARCA`, `MODELO`, `FECHA COMPRA`.
- **`EstructuraPage.tsx`** (CCP, Áreas/Ubicaciones/Responsables) ya lista `area.dependencia` en su
  tabla de Áreas — el dato ya está disponible ahí, solo falta agruparlo visualmente por Dirección
  (Organización→Dirección→Área), sin ningún cambio de backend.

## 2. Diseño

### 2.1 Migración (aditiva, sin romper nada existente)

`activos.fecha_compra date NULL` — mismo criterio que `descripcion`/`mantenimiento`/`inactivo`
agregados en fases anteriores. `fecha_alta` no se toca (sigue siendo "entrada a la BPI").

### 2.2 CORE

- `activo.repository.ts`: `SELECT_ACTIVO_SQL` suma `ar.dependencia AS "areaDependencia"`,
  `c.marca`, `c.modelo`, `a.valor_patrimonial`, `a.fecha_compra`, y un
  `LEFT JOIN responsables r ON r.id = a.responsable_id` para `r.nombre AS "responsableNombre"`.
  `serie` ya se selecciona (se usaba solo para `Activo`, ahora también sale en `ActivoCatalogo`).
- `ActivoCatalogo` (activo.types.ts): suma los 7 campos de arriba, todos nullable donde el dato
  puede faltar (cliente que no cargó Marca, activo sin responsable asignado, etc.).
- `NuevoActivoInput`/`crear()`: suma `fechaCompra?` opcional, default `null` si no viene (no se
  inventa una fecha).
- **Camino del ETL** (`importacion-contable-lote`): la fila de staging
  (`importacion_contable_lote_fila`) suma `marca`, `modelo`, `fecha_compra` (mismo patrón que
  `valorPatrimonial`/`direccionNombre` ya existentes — columnas nullable en la tabla de staging,
  no en la fila de negocio). `resolvedor-importacion.service.ts.resolverCatalogo()` pasa
  `marca`/`modelo` al crear un `catalogo_activos` nuevo (si ya existe por `categoriaNombre`, no se
  pisan — mismo criterio ya usado para no reescribir un catálogo existente). El servicio de
  aprobación de lote pasa `fechaCompra` a `activo.repository.crear()`.

### 2.3 CIS

- `core-client.types.ts` (`activoCatalogoSchema`) y `qr-connector.types.ts` (`ActivoCatalogo`):
  passthrough de los mismos 7 campos nuevos, `.nullable()` en zod. Un solo endpoint (`/catalogo`)
  sirve a APP QR y CCP — no hay contrato separado que duplicar.
- Staging de importación (`importacion-contable-lote.types.ts`/`.schemas.ts`/`.repository.ts`):
  passthrough de `marca`/`modelo`/`fechaCompra`, mismo patrón que los campos ya existentes.

### 2.4 CCP

- `cis-client.ts`: `ActivoCatalogo` suma los mismos 7 campos.
- `ActivosPage.tsx`: la tabla del catálogo pasa de 6 a 12 columnas — `No | DIRECCION | CODIGO |
  NOMBRE AFT | CATEGORIA | ESTADO | AREA | MARCA | MODELO | SERIE | FECHA COMPRA | VALOR.CLP. |
  RESPONSABLE` — exactamente el orden pedido. `No` es un contador de fila (posición en la lista
  filtrada), no un campo de backend. Celdas sin dato muestran `—` (mismo criterio que el resto de
  CCP: "Área General", "No asignada", etc.).
- `EstructuraPage.tsx`: la sección de Áreas agrega una vista agrupada por `dependencia` (Dirección)
  arriba de la tabla plana existente — encabezados de grupo con el nombre de Dirección (o "Sin
  dirección" para áreas sin ese dato, mismo criterio que `AreaLocationPicker.tsx` de APP QR),
  áreas listadas debajo de cada grupo. La tabla plana existente se mantiene (el ABM de alta/edición
  no cambia), la vista agrupada es una capa de presentación adicional sobre los mismos datos.

### 2.5 ETL (`herramientas/etl-contable/`)

- `mapeo-ejemplo.json`: suma `MARCA→marca`, `MODELO→modelo`, `FECHA COMPRA→fechaCompra`.
- `etl_contable.py`: `marca`/`modelo` viajan como texto tal cual (sin normalizar, igual que
  `nombreAft`). `fechaCompra` se parsea con el mismo normalizador de fecha que ya exista para
  columnas de fecha en el Excel (si no hay uno genérico, se agrega uno mínimo: Excel serial date
  → ISO, tolerante a vacío → `null`).

## 3. Fuera de alcance (explícito)

- Árbol jerárquico N-niveles configurable por tipo de cliente (descartado, ver §0).
- Edición de Marca/Modelo/Fecha de compra desde la ficha técnica de CCP (hoy son de solo lectura,
  se cargan por el ETL o por la Alta Rápida existente — agregar edición inline es un incremento
  aparte si se necesita).
- Cambiar qué es "categoría": se reusa `familia` tal cual, no se agrega un campo `categoria`
  paralelo.

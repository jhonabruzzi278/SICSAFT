# DOC-033 — Dirección como nivel de selección previo a Área en el escaneo

> Diseño antes que código (`CLAUDE.md` Metodología AI-DLC). A diferencia de DOC-017, este ítem
> **sí** toca el contrato CIS↔CORE (DOC-006) — agrega un campo de solo lectura al catálogo, no
> cambia su forma general ni requiere migración.

## 0. Origen y alcance

Pedido directo del usuario (2026-09-11), con dos capturas de referencia de un Excel de ejemplo:

```
DIRECCION              →  AREA
DIRECCION GENERAL      →  OFICINA DIRECTOR GENERAL
```

Estructura pedida: el Profesional de AFT define en el Excel toda la jerarquía por debajo de la
Organización (que se sigue creando en el wizard del `.exe`) — Dirección y Área como dos columnas
del mismo Excel de importación contable. En la APP QR, al iniciar un control se debe **elegir
primero la Dirección y luego el Área** (dependiente de la Dirección elegida), en vez del selector
de Área plano actual.

Esto profundiza la respuesta ya dada en esta misma sesión sobre flexibilidad de "Dirección" para
clientes simples (ver conversación — no hay documento propio de esa respuesta): Dirección sigue
siendo el campo `dependencia` ya existente en `areas` (nullable, sin tabla propia), pero ahora deja
de ser solo una etiqueta libre — se usa además para **agrupar y filtrar** el selector de Área en el
flujo de escaneo.

## 1. Confirmación de modelo de datos — sin migración

`core/migrations/1755100000000_schema-patrimonial.ts`: `areas.dependencia` ya existe, `text`
nullable, sin tabla `direcciones` separada. "Dirección" = valor de texto compartido por N filas de
`areas` dentro de la misma organización. No se crea tabla nueva — agrupar por el valor literal de
`dependencia` alcanza para lo pedido.

El ETL contable (`herramientas/etl-contable/`, DOC-029 RF-B) ya mapea una columna `DIRECCION` del
Excel del cliente a `area.dependencia` vía `mapeo-<organizacionId>.json` — **no requiere cambios**.
Lo que falta es que ese valor viaje desde CORE hasta la APP QR (hoy se pierde en el camino) y que
la UI de escaneo lo use para un segundo nivel de selección.

## 2. Por qué toca 3 sistemas (CORE → CIS → APP QR)

`core/src/patrimonial/activo.repository.ts` ya hace `LEFT JOIN areas ar ON ar.id = a.area_id` para
resolver `areaNombre` en el catálogo (línea ~51) — agregar `ar.dependencia` a ese mismo SELECT es
trivial (no hay JOIN nuevo). Pero ese campo no está en ninguna de las tres capas de tipos que
transportan el catálogo hoy:

1. `core/src/patrimonial/activo.types.ts` (`ActivoCatalogo`, respuesta de CORE)
2. `cis/src/core-client/core-client.types.ts` (`ActivoCatalogo`, lo que CIS recibe de CORE) +
   `cis/src/qr-connector/qr-connector.types.ts` (`ActivoCatalogo`, lo que CIS expone a la APP QR)
3. `app-qr-sicsaft/src/lib/qr-connector.ts` (`ConnectorAsset`) + `organizations-data.ts`
   (`Organization`/`OrgArea`, forma que usa la UI)

Es el mismo patrón de "passthrough sin transformar" que ya documenta DOC-006 para el resto del
catálogo (`areaNombre`, `ubicacionNombre`) — se agrega un campo más a la misma cadena, no un
endpoint nuevo.

**Nombre de campo elegido**: `areaDependencia` (mismo prefijo `area*` que `areaNombre`, evita
inventar el término "Dirección" a nivel de contrato — ese es un nombre de UI/negocio, el campo de
datos sigue llamándose como la columna real de `areas`).

## 3. Diseño de la UI de selección (`AreaLocationPicker.tsx`)

Regla central — **coherente con la respuesta ya dada al usuario sobre clientes simples**: el paso
de Dirección solo aparece si la organización tiene al menos un área con `dependencia` no nula. Si
**todas** las áreas de la organización tienen `dependencia: null` (cliente simple que no cargó esa
columna en su Excel), el picker se comporta exactamente como hoy — un solo selector de Área.

Cuando sí hay Direcciones:
- Nivel 1: selector de Dirección — opciones = valores únicos de `dependencia` entre las áreas de
  la organización, más un bucket `"Sin dirección"` al final si además existen áreas con
  `dependencia: null` conviviendo con áreas que sí la tienen (caso mixto, plausible durante una
  migración de catálogo).
- Nivel 2: selector de Área — solo las áreas cuya `dependencia` calza con la Dirección elegida
  (reinicia su selección al cambiar la Dirección, mismo patrón que ya existe entre Área→Ubicación
  en el componente actual).
- Nivel 3: selector de Ubicación — sin cambios, sigue dependiendo del Área elegida.

No se persiste la Dirección elegida como campo propio de `ScanSession` — es un filtro de UI para
llegar al Área, igual que hoy Ubicación no se guarda por separado del Área en el resumen del
reporte (YAGNI: no hay consumidor de negocio para "Dirección" fuera de este selector todavía).

## 4. Plan de implementación por capa

| Capa | Archivo | Cambio |
|---|---|---|
| CORE | `patrimonial/activo.repository.ts` | Agregar `ar.dependencia AS "areaDependencia"` al SELECT; `ActivoRow` + mapeo a la respuesta |
| CORE | `patrimonial/activo.types.ts` | `ActivoCatalogo.areaDependencia: string \| null` |
| CIS | `core-client/core-client.types.ts` | `ActivoCatalogo.areaDependencia` (interface + schema zod `.nullable()`) |
| CIS | `qr-connector/qr-connector.types.ts` + `qr-connector.service.ts` | Passthrough del campo hacia la APP QR |
| APP QR | `lib/qr-connector.ts` | `ConnectorAsset.areaDependencia?`; `buildOrganizationTree` agrupa por dirección |
| APP QR | `lib/organizations-data.ts` | Nuevo `OrgDireccion { id, name, areas: OrgArea[] }`; `Organization.direcciones: OrgDireccion[]` |
| APP QR | `components/AreaLocationPicker.tsx` | Selector de Dirección condicional + cascada hacia Área |

## 5. Test strategy

- CORE: `activo.repository.spec.ts` — nuevo caso con área con `dependencia` no nula, confirma que
  llega en la fila mapeada.
- CIS: `core-client.service.spec.ts` y el spec del `qr-connector` — confirman passthrough del campo
  nuevo sin romper los casos existentes con `dependencia: null`.
- APP QR: test de `buildOrganizationTree` — caso con direcciones mixtas (con y sin
  `dependencia`), caso 100% sin dirección (debe colapsar a un solo nivel, sin bucket
  "Sin dirección" espurio). Test de `AreaLocationPicker` — no debe mostrar el selector de Dirección
  cuando todas las áreas son `dependencia: null`; debe filtrar Área correctamente al cambiar de
  Dirección.

# DOC-006: API CIS↔CORE

> **Estado**: implementado en ambos lados. CORE sirve estos 3 endpoints desde Fase 2
> (`core/src/patrimonial/catalogo.controller.ts`, `core/src/inventarios/inventarios.controller.ts`)
> y CIS los consume desde Fase 3 (`cis/src/qr-connector/qr-connector.service.ts`, proxy delgado
> hacia `CoreClientService`) — formaliza el contrato que
> `cis/src/qr-connector/qr-connector.controller.ts` expone hacia APP QR (implementando
> [DOC-002](../../../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md)) contra lo
> que CORE sirve del otro lado. CIS es un **proxy delgado**: no necesitó cambiar sus tipos
> (`qr-connector.types.ts`) para consumir esto — si algo no calzaba, este documento se ajustaba,
> no el contrato ya construido con APP QR.

## ⚠️ Hallazgo del diseño: DOC-005 tiene dos errores respecto al contrato ya acordado en DOC-002

Al diseñar este documento contra el contrato real de DOC-002 (no contra la memoria de qué se
pensaba implementar), aparecieron dos discrepancias con
`base-patrimonial/DOC-005-modelo-patrimonial.md` 5 (ya migrado y en `main`):

1. **Nombre de categoría equivocado**: DOC-005 usó `codigo_invalido`; DOC-002 2 y
   `cis/src/qr-connector/qr-connector.schemas.ts` (`scanResultadoSchema`) ya usan **`invalido`**
   a secas. Corrección: nueva migración en Fase 2 que renombra el valor permitido por el
   `CHECK` de `inventarios.resultado` — no se edita la migración `1755100000000` ya compartida.
2. **Granularidad de `Inventario`**: DOC-005 modeló `inventarios` como una fila por
   *activo verificado*. Eso es correcto como grano de almacenamiento (coincide con Tomo III 4.6:
   "Fecha, Usuario, Método, Resultado, Observaciones" por verificación), pero DOC-002 2 confirma
   que `POST /inventarios` envía **una sesión completa cerrada** (`escaneos: []`,
   `incidencias: []`, con un único `inventarioId`/`idempotencyKey` para todo el lote — "la unidad
   atómica es la sesión de inventario completa", DOC-002 4). Falta una entidad que agrupe esas
   filas. Corrección: nueva tabla `sesiones_inventario` en Fase 2 (ver 3).

Ninguna de las dos requiere revertir DOC-005 — son adiciones/correcciones aditivas sobre lo ya
migrado, con su propia migración nueva en esta fase.

## 1. Endpoints

Mismos 4 que CIS ya expone hacia APP QR (DOC-002 2) menos `POST /auth/session` (ese lo resuelve
`GET /entitlements`, ya implementado desde Fase 0 — no es parte de esta fase):

| Endpoint | Método | Implementa | Auth |
|---|---|---|---|
| `/catalogo` | `GET` | RF-01 | `ServiceTokenGuard` (ya existe) |
| `/inventarios` | `POST` | RF-02, RF-07 | `ServiceTokenGuard` |
| `/inventarios/:inventarioId/estado` | `GET` | RF-03 | `ServiceTokenGuard` |

Todos requieren `x-internal-service-token` (secreto compartido, sin cambios) y propagan
`X-Correlation-Id` (sin cambios, ya lo hace `CoreClientService` desde Fase 0).

## 2. `GET /catalogo`

**Query**: `organizacionId` (requerido), `areaId`/`ubicacionId` (opcionales) — idéntico a
`CatalogoQuery` de CIS.

**Response** — misma forma que `CatalogoResponse` de CIS, resuelta contra `activos`/
`catalogo_activos` (DOC-005), paginado (RNF-01, `limit`/`cursor` — sin definir el mecanismo de
paginación en detalle acá, se resuelve al implementar siguiendo el patrón que ya use
`entitlements` si lo tuviera, o `LIMIT`/`OFFSET` simple si no hay precedente):

```ts
interface ActivoCatalogo {
  codigoQr: string;
  nombre: string;       // viene de catalogo_activos (tipo + familia, o un nombre propio si se agrega mas adelante)
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  estado: string;       // activo | en_transito | extraviado | dado_de_baja
}
```

## 3. `POST /inventarios`

**Request** — idéntico a `InventarioRequest` de CIS (`inventarioRequestSchema`):

```ts
interface InventarioRequest {
  correlationId: string;      // de negocio (DOC-002 6) -- distinto del header X-Correlation-Id
  idempotencyKey: string;
  operadorId: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  fechaInicio: string;
  fechaCierre: string;
  escaneos: Array<{ codigoQr: string; resultado: ScanResultado }>;
  incidencias: Array<{ codigoQr: string; descripcion: string }>;
}
```

**El `resultado` que manda el cliente es una sugerencia offline, no la verdad**: la app clasifica
localmente contra su último catálogo sincronizado (`app-qr-sicsaft/src/lib/scan-resolve.ts`),
que puede estar desactualizado. DOC-002 1 es explícito: "aplicar Reglas patrimoniales... eso
vive en CORE". El Motor de Reglas (DOC-009) **reclasifica cada escaneo contra la Base
Patrimonial real** y ese es el `resultado` que se persiste — el del cliente solo se guarda como
lo que el operador vio en el momento, para auditoría de discrepancias (¿por qué el operador vio
"correcto" y CORE dice "otra_area"? → catálogo del dispositivo desactualizado).

**Persistencia** (resuelve el hallazgo 0):

```sql
-- nueva en Fase 2
CREATE TABLE sesiones_inventario (
    id TEXT PRIMARY KEY,                 -- el "inventarioId" que ve el cliente
    idempotency_key TEXT NOT NULL UNIQUE,
    organizacion_id TEXT NOT NULL REFERENCES organizaciones(id),
    area_id TEXT NOT NULL REFERENCES areas(id),
    ubicacion_id TEXT NOT NULL REFERENCES ubicaciones(id),
    operador_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,        -- correlationId de negocio del payload (DOC-002 6)
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_cierre TIMESTAMPTZ NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'recibido', 'rechazado')),
    request_hash TEXT NOT NULL,          -- detecta idempotencyKey reusada con payload distinto
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`inventarios.sesion_id` (columna nueva, FK a `sesiones_inventario.id`) agrupa las filas de una
misma sesión — una fila por `escaneo` del array, con el `resultado` **recalculado por CORE**, y
`observaciones` poblado desde `incidencias[]` cuando el `codigoQr` coincide.

**Response** — idéntico a `PostInventarioResponse`:

```ts
interface PostInventarioResponse {
  inventarioId: string;   // = sesiones_inventario.id
  estado: 'recibido' | 'rechazado';
  errores?: Array<{ campo: string; detalle: string }>;
}
```

**Idempotencia** (RF-07): `idempotencyKey` único en `sesiones_inventario`. Mismo key + mismo
`request_hash` → se devuelve la fila existente sin reprocesar. Mismo key + hash distinto → `409`
(DOC-002 5, "tratar como bug de cliente").

## 4. `GET /inventarios/:inventarioId/estado`

Idéntico a `InventarioEstadoResponse` de CIS — lee `sesiones_inventario.estado` +
`creado_en` como `ultimoIntento`.

## 5. Errores

Mismo mapeo que DOC-002 5 ya define del lado del cliente — CORE es quien produce estos códigos:

| Código | Cuándo |
|---|---|
| `400` | Payload inválido (organización/área/ubicación inexistente) — `errores[]` con `{campo, detalle}` |
| `409` | `idempotencyKey` reusada con payload distinto |
| `401` | Falta o es inválido `x-internal-service-token` (ya existe, `ServiceTokenGuard`) |

No hay `404` de negocio: un `codigoQr` que no matchea ningún activo **no es un error HTTP**, es
la categoría `no_registrado` dentro de una respuesta `201` exitosa (DOC-009).

## Documentos relacionados

[DOC-002](../../../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md) — contrato
origen, del lado de CIS↔APP QR, que este documento no debe romper.
[DOC-005](../../../base-patrimonial/DOC-005-modelo-patrimonial.md) — tablas sobre las que corre
este contrato (con las dos correcciones de 0 pendientes de migrar).
[DOC-009](DOC-009-motor-reglas.md) — cómo se recalcula `resultado` en el servidor.

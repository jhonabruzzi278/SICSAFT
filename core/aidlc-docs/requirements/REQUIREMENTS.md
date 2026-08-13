# Requirements — CORE Fase 2

## Funcionales

| ID | Requisito | Fuente |
|---|---|---|
| RF-01 | CORE expone `GET /catalogo` filtrable por `organizacionId`/`areaId`/`ubicacionId`, reemplazando `SEED_CATALOGO` de CIS. | DOC-002 §3, `cis/src/qr-connector/qr-connector.types.ts` (`CatalogoResponse`) |
| RF-02 | CORE expone `POST /inventarios`, idempotente por `idempotencyKey`, que clasifica el escaneo en una de las 8 categorías de `DOC-005` §5. | DOC-002 §4/§6, `base-patrimonial/DOC-005-modelo-patrimonial.md` §5 |
| RF-03 | CORE expone `GET /inventarios/:inventarioId/estado`. | DOC-002 §3, `qr-connector.types.ts` (`InventarioEstadoResponse`) |
| RF-04 | Toda escritura (`POST /inventarios`) genera un registro en `eventos` (Motor de Eventos) y en `auditoria` (Motor de Auditoría), con el mismo `correlationId` de la request (WAF §2). | Tomo IV §2.9, `ARQUITECTURA-WAF.md` §2 |
| RF-05 | El Motor Patrimonial resuelve consulta de activos, cambio de ubicación/estado y traslado — no alta/baja/reincorporación/cambio de responsable (Fase 4). | `core/README.md` § Arquitectura interna, ROADMAP.md Fase 2 |
| RF-06 | El Orquestador es el único punto de entrada — ningún motor se invoca directo desde un controller. | Tomo IV §2.4, "toda operación pasa primero por acá" |
| RF-07 | La idempotencia de `POST /inventarios` vive en CORE (persistida), no en CIS (memoria de proceso, como hoy). | ROADMAP.md riesgo ya identificado en Fase 0 |

## No funcionales

| ID | Requisito | Fuente |
|---|---|---|
| RNF-01 | Ningún endpoint de listado devuelve un dataset sin paginar. | `ARQUITECTURA-WAF.md` §5 |
| RNF-02 | Todo error de negocio (activo no encontrado, código inválido) usa el mismo formato ya definido en DOC-002 §5 (`errores: [{campo, detalle}]`) — sin inventar un formato nuevo. | DOC-002 §5 |
| RNF-03 | Cobertura de tests igual al umbral ya vigente en `core/` (100% stmts/lines/funcs, branches sobre el piso del proyecto) — sin relajar el `coverageThreshold` de `package.json` para esta fase. | `core/package.json` |
| RNF-04 | Los 4 motores son módulos Nest dentro del mismo desplegable — no microservicios (YAGNI). | `ARQUITECTURA-WAF.md` §1/§9 |
| RNF-05 | El código nuevo sigue el patrón ya establecido en `core/src/entitlements/` (repository + service + controller + schemas Zod), no introduce un patrón distinto sin justificar por qué. | Consistencia con el código existente |

## Fuera de alcance (explícito)

- Motor de Alertas, Motor de Reportes, Gestión Documental, Gestión de Usuarios/Permisos como
  motores completos — sin consumidor (ver `requirements/INTENT.md`).
- Cualquier cambio a `app-qr-sicsaft/` — el cliente real es TASK-007 (Fase 3).
- `Configuración`/`Integraciones` de Base Patrimonial — no modelados (DOC-005 §1).

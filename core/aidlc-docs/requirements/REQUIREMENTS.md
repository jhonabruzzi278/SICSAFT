# Requirements — CORE Fase 2

> Alcance original: CORE Fase 2 (Orquestador + 4 motores de lectura). Las Fases 4/5 agregaron
> capacidad real de escritura (Administrador Patrimonial, Auditoría, Área/Ubicación/Responsable)
> sin numerar RF nuevos acá — su detalle vive en
> [`seguridad/DOC-012-administrador-patrimonial.md`](../../../seguridad/DOC-012-administrador-patrimonial.md)
> y en `core/README.md`. Ver `REQUISITOS.md` (raíz del repo) para el índice consolidado de todo
> el ecosistema.

## Funcionales

| ID | Requisito | Estado | Fuente |
|---|---|---|---|
| RF-01 | CORE expone `GET /catalogo` filtrable por `organizacionId`/`areaId`/`ubicacionId`, reemplazando `SEED_CATALOGO` de CIS. | ✅ Implementado | DOC-002 3, `cis/src/qr-connector/qr-connector.types.ts` (`CatalogoResponse`) |
| RF-02 | CORE expone `POST /inventarios`, idempotente por `idempotencyKey`, que clasifica el escaneo en una de las 8 categorías de `DOC-005` 5. | ✅ Implementado | DOC-002 4/6, `base-patrimonial/DOC-005-modelo-patrimonial.md` 5 |
| RF-03 | CORE expone `GET /inventarios/:inventarioId/estado`. | ✅ Implementado | DOC-002 3, `qr-connector.types.ts` (`InventarioEstadoResponse`) |
| RF-04 | Toda escritura (`POST /inventarios`) genera un registro en `eventos` (Motor de Eventos) y en `auditoria` (Motor de Auditoría), con el mismo `correlationId` de la request (WAF 2). | ✅ Implementado | Tomo IV 2.9, `ARQUITECTURA-WAF.md` 2 |
| RF-05 | El Motor Patrimonial resuelve consulta de activos, cambio de ubicación/estado y traslado — no alta/baja/reincorporación/cambio de responsable (Fase 4). | ⚠️ Parcial — consulta ✅; traslado y cambio de ubicación/estado **no existen todavía, ni el método en `ActivoRepository` ni el controller** (corregido 2026-08-14: DOC-008 decía "se deja el método en el repository", verificado contra el código que no es así). Documentado como YAGNI — sin consumidor real (ningún cliente pide trasladar un activo hoy), no vale la pena ni el scaffold; se construye método+controller juntos cuando aparezca un consumidor real. | `core/README.md` Arquitectura interna, DOC-008, ROADMAP.md Fase 2 |
| RF-06 | El Orquestador es el único punto de entrada — ningún motor se invoca directo desde un controller. | ✅ Implementado (se sostuvo también en Fase 4/5: Administrador Patrimonial y Estructura pasan por `OrquestadorService`) | Tomo IV 2.4, "toda operación pasa primero por acá" |
| RF-07 | La idempotencia de `POST /inventarios` vive en CORE (persistida), no en CIS (memoria de proceso, como hoy). | ✅ Implementado | ROADMAP.md riesgo ya identificado en Fase 0 |

## No funcionales

| ID | Requisito | Estado | Fuente |
|---|---|---|---|
| RNF-01 | Ningún endpoint de listado devuelve un dataset sin paginar. | ✅ Implementado (cerrado 2026-08-14) — `GET /contratos`, `/auditoria`, `/areas`, `/ubicaciones`, `/responsables` devuelven `{ <entidad>, total }` con `limit`/`offset` (default 20, tope 100), mismo criterio que `GET /catalogo`. `ContratoRepository.findPagina` reusa `findAll()` internamente (no pagina en SQL) para preservar la invariante de contrato vigente único por sede (DOC-004 4), validada contra el dataset completo; los otros 4 repositorios paginan con `COUNT(*)` + `LIMIT`/`OFFSET` en SQL | `ARQUITECTURA-WAF.md` 5 |
| RNF-02 | Todo error de negocio (activo no encontrado, código inválido) usa el mismo formato ya definido en DOC-002 5 (`errores: [{campo, detalle}]`) — sin inventar un formato nuevo. | ✅ Implementado | DOC-002 5 |
| RNF-03 | Cobertura de tests igual al umbral ya vigente en `core/` (100% stmts/lines/funcs, branches sobre el piso del proyecto) — sin relajar el `coverageThreshold` de `package.json` para esta fase. | ✅ Mantenido (221 tests, 100% stmts/lines/funcs a la fecha) | `core/package.json` |
| RNF-04 | Los 4 motores son módulos Nest dentro del mismo desplegable — no microservicios (YAGNI). | ✅ Implementado (se sostuvo en Fase 4/5: `src/estructura/`, `src/auditoria/` con controller, todo el mismo desplegable) | `ARQUITECTURA-WAF.md` 1/9 |
| RNF-05 | El código nuevo sigue el patrón ya establecido en `core/src/entitlements/` (repository + service + controller + schemas Zod), no introduce un patrón distinto sin justificar por qué. | ✅ Implementado (mismo patrón replicado en `src/patrimonial/`, `src/estructura/`, `src/auditoria/`) | Consistencia con el código existente |

## Fuera de alcance (explícito)

- Motor de Alertas, Motor de Reportes, Gestión Documental, Gestión de Usuarios/Permisos como
  motores completos — sin consumidor (ver `requirements/INTENT.md`).
- Cualquier cambio a `app-qr-sicsaft/` — el cliente real es TASK-007 (Fase 3).
- `Configuración`/`Integraciones` de Base Patrimonial — no modelados (DOC-005 1).

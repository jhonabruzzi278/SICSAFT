# Contrato — Pantalla 8: Resultados de la acción de supervisión y control de AFT

Contenido exacto del **informe de control de área**: lo arma la APP QR del móvil al cerrar un
control y lo envía a CORE. Es la cara detallada de [CU-INV-003](dominios/CU-INV-inventarios.md)
(conciliar) y [CU-INV-004](dominios/CU-INV-inventarios.md) (cerrar). Origen: spec del usuario
(2026-08-31, "PANTALLA 8").

> **Título en pantalla**: *RESULTADOS DE ACCIÓN DE SUPERVISIÓN Y CONTROL DE AFT*
> **Cuándo aparece**: al cerrar la sesión de relevamiento de un área en la APP QR (CU-INV-004),
> antes/después de enviar el informe a SICSAFT CORE (`POST /inventarios`).

## Encabezado

`Organización` · `Área` · `Fecha` · `Hora`.
→ Ya en `InventarioRequest` (`organizacionId`, `areaId`, `fechaInicio`, `fechaCierre`) y en
`SesionDetalle`.

## Contenido (los 6 bloques)

| # | Bloque | De dónde sale | Estado |
|---|--------|---------------|--------|
| **1** | **Cantidad de AFT escaneados** | `count(escaneos)` de la sesión | 🟢 existe |
| **2** | **Cantidad y % de AFT que pertenecen al área** (número **y %**) | numerador = escaneos con `resultado = correcto`; denominador = activos registrados en el área (`GET /catalogo?areaId=`) | 🟡 el conteo existe; falta el **%** y su cálculo |
| **3** | **Estado de los AFT** declarado por el controlador **por cada AFT** durante el control: `EN SERVICIO` · `EN MANTENIMIENTO` · `INACTIVO` · `BAJA` | `escaneos[].estadoDeclarado` (`activo`→EN SERVICIO, `mantenimiento`, `inactivo`) y `escaneos[].bajaSugerida` (→BAJA, evento informativo, **no** cambia `Activo.estado` sin el rol administrador-patrimonial). Fase 3.1 / DOC-017 / DOC-012 §5.1 | 🟢 el payload y la transición ya existen; falta el **desglose por estado** en el resumen + confirmar la UI de marcado por escaneo en `ScanPage.tsx` |
| **4** | **Lista de AFT escaneados**: nombre + código, destacando **tipo**: `ORDINARIO` (solo etiqueta QR) / `EXTRAORDINARIO` (QR + RFID) | nombre/código de `activos`; tipo derivado de `catalogo_activos.tecnologia_identificacion` → `qr` = ORDINARIO, `rfid`/`qr_rfid` = EXTRAORDINARIO | 🟡 la lista existe; falta exponer y mostrar el **tipo** |
| **5** | **AFT que NO corresponden al área**: cantidad + lista con **nombre, tipo, y a qué área de la organización pertenecen** | escaneos con `resultado = otra_area` / `otra_ubicacion`; el "área a la que pertenece" = `activo.areaId` real | 🟡 el Dashboard ya lista los "fuera de área" con `codigoQr` y `areaRealId→areaEsperadaId`; falta **nombre + tipo** |
| **6** | **Declaración del proceso** (veredicto) con **fondo de color** | `calcularVeredicto(faltantes, fueraDeArea)` — `app-qr-sicsaft/src/lib/verdict.ts` = `cip/src/agregacion/veredicto.ts`, DOC-017 §2 | 🟢 la lógica ya es exactamente esta; falta el **fondo de color** en la presentación |

## Reglas del veredicto (bloque 6)

`faltantes` = AFT registrados en el área que **no** se escanearon. `fueraDeArea` = AFT escaneados
que pertenecen a otra área.

| Veredicto | Condición | Fondo | En el repo |
|---|---|---|---|
| **EXITOSO** | `faltantes = 0` **y** `fueraDeArea = 0` — todos los AFT son del área y se escanearon todos | 🟩 verde | `exitoso` ("excelente" del negocio) |
| **ACEPTABLE** | exactamente **uno** de los dos problemas (o faltan AFT del área, o aparecieron AFT de otra área — **no** ambos). Declarar los AFT fuera de área y a qué área pertenecen | 🟨 amarillo | `aceptable` |
| **DEFECTUOSO** | **ambos** a la vez: hay AFT ausentes del control **y** hay AFT de otras áreas | 🟥 rojo | `defectuoso` — dispara además la auto-auditoría de DOC-029 RF-D §D.3 |

## Qué falta construir — RF-I (agregar al plan de DOC-029)

Casi todo el plumbing existe; RF-I es agregación + presentación:

| Capa | Trabajo |
|---|---|
| **CORE / CIP** | Un resumen de control por sesión (extender `GET /inventarios/:id` o un `GET /dashboard/control/:sesionId`) que devuelva: escaneados, del-área (n y %), desglose por estado declarado, lista escaneados con nombre + tipo (ordinario/extraordinario), lista fuera-de-área con nombre + tipo + área real, faltantes, y el veredicto |
| **APP QR** | Pantalla 8 al cerrar la sesión, renderizando ese resumen con los fondos de color; confirmar/ajustar la UI de marcado de estado por AFT durante el escaneo (Fase 3.1) |
| **CCP (Resumen)** | La misma Pantalla 8 por sesión, en "Sesiones de inventario" → detalle, con los colores |

No requiere migración nueva ni cambia el invariante: `estadoDeclarado` ya existe como transición
best-effort sin rol (Tomo III 1.4); `bajaSugerida` sigue siendo solo un evento.

## Documentos relacionados

[CU-INV-inventarios.md](dominios/CU-INV-inventarios.md) (CU-INV-002/003/004),
[CU-INC-incidencias.md](dominios/CU-INC-incidencias.md),
[PLAN-QA.md](PLAN-QA.md) (QA-3.9 y QA-4 validan esta pantalla),
`aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-017-fase-3.1-brechas-flujo.md` (§2 veredicto,
`estadoDeclarado`/`bajaSugerida`), DOC-009 (árbol de clasificación de escaneo),
[DOC-029](../aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) RF-D §D.3.

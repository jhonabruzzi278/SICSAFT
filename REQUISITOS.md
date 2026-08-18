# Requisitos del ecosistema SICSAFT — índice consolidado

> Este documento **no repite** el contenido de cada `REQUIREMENTS.md` (metodología AI-DLC,
> `CLAUDE.md`) — resume ID, resumen de una línea y estado real, y enlaza a la fuente. Si el
> resumen y la fuente entran en conflicto, gana la fuente. Estado verificado contra el código el
> 2026-08-14, en la misma sesión que cerró Fase 4 y completó Fase 5 (ver `ROADMAP.md`).

## Por sistema

| Sistema | Fuente | Alcance | RF | RNF | Estado |
|---|---|---|---|---|---|
| APP QR | [`app-qr-sicsaft/aidlc-docs/requirements/REQUIREMENTS.md`](app-qr-sicsaft/aidlc-docs/requirements/REQUIREMENTS.md) | MVP demo standalone (histórico — superado por TASK-007) | 11 | 4 | ✅ Completo (demo original) |
| CORE | [`core/aidlc-docs/requirements/REQUIREMENTS.md`](core/aidlc-docs/requirements/REQUIREMENTS.md) | Fase 2 (Orquestador + 4 motores de lectura) | 7 | 5 | ✅ Completo, 1 parcial (RF-05), YAGNI/bajo riesgo deliberado — ver detalle |
| WEB | [`web/aidlc-docs/requirements/REQUIREMENTS.md`](web/aidlc-docs/requirements/REQUIREMENTS.md) | Fase 5 (Portal WEB, 6 módulos) | 8 | 5 | ✅ Completo — 8/8 RF, 5/5 RNF |
| CIS | *(sin `aidlc-docs/`, ver nota)* | Fase 0/3/4/5 (conector QR, escritura oficial) | — | — | Sin requisitos formalizados con ID — ver nota abajo |

**CIS nunca tuvo su propio `REQUIREMENTS.md`** — se construyó antes de que el proyecto adoptara la
metodología AI-DLC completa (`app-qr-sicsaft/` fue el primer sistema en usarla, `core/` el
segundo, ver `CLAUDE.md` § "Metodología AI-DLC"). Su capacidad real (rate limiting, circuit
breaker, deviceId enforcement, puente de escritura oficial `src/administrador/`) está documentada
en `cis/README.md` y en `seguridad/DOC-012-administrador-patrimonial.md`, sin RF/RNF numerados.
Formalizarlo retroactivamente no está en alcance de este índice — se anota como deuda de
documentación conocida.

## RF/RNF con estado parcial (gaps reales, no solo "fuera de alcance")

Estos son requisitos que **sí** están en el alcance declarado de su fase y quedaron sin resolver
en el incremento que los construyó — distinto de un ítem marcado "fuera de alcance" (que nunca se
pidió). Priorizados por severidad:

| Sistema | ID | Qué falta | Por qué importa |
|---|---|---|---|
| CORE | RF-05 | Traslado y cambio de ubicación/estado de Activo — **ni el método en `ActivoRepository` ni el controller existen** (corregido 2026-08-14: la documentación decía "el repository ya tiene los métodos", verificado contra el código que no) | Deliberadamente YAGNI — sin consumidor real (ningún cliente pide trasladar un activo hoy), construir el método+controller sin quien los llame sería especulativo. **No se recomienda cerrar este ítem con código** — se cierra solo, naturalmente, cuando aparezca un consumidor real (mismo criterio que el propio ROADMAP.md ya aplica a otros motores) |
| APP QR | RNF-01/RNF-02 | Sin validar en dispositivo Android físico ni iOS físico (offline real, PWA instalable). La PWA es multiplataforma por diseño (Android/iOS/Windows/Mac, un solo código) — no falta reconstrucción, falta la prueba real en ambos | Fuera de alcance de este repositorio — requiere una persona con un teléfono/tablet real de cada plataforma; ningún cambio de código lo cierra. Queda anotado como bloqueado en acción humana, no como deuda técnica |

**Cerrado 2026-08-14**:
- ~~WEB RF-06 — `GET /auditoria` sin filtro~~. `AuditoriaRepository.listar` (CORE) ganó filtros por
  `usuario`/`operacion` (`ILIKE '%valor%'`) y rango `fechaDesde`/`fechaHasta`; `AuditoriaPage`
  (WEB) agregó el formulario correspondiente. Verificado con unit + e2e reales contra Postgres.
- ~~WEB RF-05 — sin edición de Área/Ubicación~~. `AreaRepository.actualizar`/
  `UbicacionRepository.actualizar` (CORE) agregan `PATCH /areas/:id`/`PATCH /ubicaciones/:id`,
  incluida la asignación de `responsable_id`/`ubicacion_principal_id` a un Área; puente en CIS
  (`PATCH /admin/areas/:id`, `PATCH /admin/ubicaciones/:id`) y formularios de edición en
  `EstructuraPage` (WEB). Verificado con unit + e2e reales contra Postgres.
- ~~CORE RNF-01 — 5 endpoints de Fase 5 sin paginar~~. `GET /contratos`, `/auditoria`, `/areas`,
  `/ubicaciones`, `/responsables` devuelven ahora `{ <entidad>, total }` con `limit`/`offset`
  (default 20, tope 100), mismo criterio que `GET /catalogo`. `ContratoRepository.findPagina`
  reusa `findAll()` internamente para no romper la invariante de contrato vigente único por sede
  (DOC-004 §4), que se valida contra el dataset completo; los otros 4 repositorios paginan con
  `COUNT(*)` + `LIMIT`/`OFFSET` en SQL. CIS propaga `limit`/`offset` end-to-end
  (`administrador.schemas.ts`, `core-client.types.ts`). WEB no tiene UI de paginación (ningún RF
  la pide) — `cis-client.ts` pide el tope de página (100) para no perder filas silenciosamente
  mientras el volumen se mantenga bajo esa cota; si crece más allá, requerirá UI de paginación real
  (nuevo RF, no este). Verificado con unit + e2e reales contra Postgres en CORE, unit + e2e en CIS,
  build limpio en WEB.
- ~~WEB RNF-05 — accesibilidad sin verificar~~. Contraste calculado real (compositing de opacidad
  incluido) contra la fórmula WCAG 2.1 para cada color/fondo del sistema de diseño. Encontró y
  corrigió un hallazgo real: el badge de estado `vencido`/fallback tenía 3.50:1 de contraste
  efectivo (bajo el mínimo AA de 4.5:1) — corregido a 6.64:1. El resto del sistema de color ya
  pasaba AA cómodamente (4.1–18:1 según par texto/fondo).

## Requisitos nuevos identificados en spec funcional (pptx), sin formalizar todavía

Fuente: `PROCESO MODULAR DE APLICACION SICSAFT, SOFTWARE.ppt` (fuera de git, revisado 2026-08-17
— ver [`ROADMAP.md`](ROADMAP.md) § "Fuente nueva: spec funcional de flujo por pantallas"). Describe
el flujo pantalla-a-pantalla completo de los 3 modos de producto (QR / QR+WEB / QR+WEB+RFID).
Comparado contra el código real, aporta requisitos que **todavía no tienen ID formal en ningún
`REQUIREMENTS.md`** porque no fueron diseñados con metodología AI-DLC todavía — se listan acá para
no perderlos, con ID definitivo pendiente de asignar cuando se diseñe cada incremento.

| Candidato | Sistema | Qué pide | Estado | Roadmap |
|---|---|---|---|---|
| Selector de modo 1/2/3 | APP QR | Pantalla para elegir QR / QR+WEB / QR+WEB+RFID antes del control | ✅ Implementado — `lib/scan-mode.ts`, verificado e2e | Fase 3.1 |
| Declaración de resultado de sesión (EXITOSO/ACEPTABLE/DEFECTUOSO) | APP QR | Veredicto agregado del control, distinto de las 8 categorías de escaneo por ítem ya implementadas (DOC-009) | ✅ Implementado — `lib/verdict.ts`, verificado e2e y contra Postgres real | Fase 3.1 |
| Estado del AFT declarado durante el control: en servicio/mantenimiento/inactivo | APP QR + CORE | Marcar el estado (no destructivo) de cada activo al escanearlo | ✅ Implementado — migración `1755400000000`, `POST /inventarios` extendido, sin rol nuevo (Tomo III §1.4), verificado e2e contra Postgres real | Fase 3.1 |
| Estado del AFT declarado durante el control: baja sugerida | APP QR + CORE | El operador sugiere la baja (dato informativo); el Administrador Patrimonial la revisa y ejecuta desde WEB | ✅ Implementado — evento `baja_sugerida`, no toca `Activo.estado`, sin conflicto con Tomo III §1.4 | Fase 3.1 |
| Lista de AFT fuera de área con su área real | APP QR | Agregado del informe de control; dato ya disponible en la clasificación existente | ✅ Implementado — sección agrupada en `ScanPage.tsx`, verificado e2e | Fase 3.1 |
| Gráfico circular por categoría de AFT | CIP | Visualización por área (informática, mobiliario, equipos varios, enseres de cocina, etc.) | ✅ Implementado — `GET /dashboard/categorias` (dato real, agregado por área/familia), sin frontend todavía (fuera de alcance de este incremento) | Fase 6 |
| Informe diario automático a hora fija | CIP | Resumen de toda la organización: cobertura, control exitoso/aceptable/defectuoso, AFT por estado | 🔲 No implementado — requiere scheduler + canal de entrega, deliberadamente fuera de alcance (`cip/aidlc-docs/requirements/INTENT.md`) | Fase 6 |
| Clasificación ordinario (QR)/extraordinario (QR+RFID) | RFID | Por activo, según qué etiquetas tiene | 🔲 No implementado | Fase 8 |
| Mapa de zonificación con alarmas en tiempo real | RFID | Plano de la organización con AFT extraordinarios y dispositivos de alarma por entrada/salida de área | 🔲 No implementado | Fase 8 |

**Confirma sin agregar alcance nuevo**: Modo 2 del pptx (dashboard web con todos los datos de la
organización) ya está cubierto por WEB Fase 5; "CORE recibe solo actualizaciones del especialista
contable, con responsabilidad de actualizar diariamente" ya está documentado en Fase 7
(CON-CONTABILIDAD) — el pptx confirma la necesidad de negocio en ambos casos, no pide algo nuevo.

## Cómo se usa este índice

- **Para trabajar en un sistema**: leer su `REQUIREMENTS.md` completo — este índice es un resumen
  de navegación, no la fuente de verdad.
- **Para saber qué falta del roadmap**: cruzar la tabla de gaps de arriba con
  [`ROADMAP.md`](ROADMAP.md) § "Próximo paso sugerido" de cada sistema — los dos deberían decir lo
  mismo; si divergen, uno de los dos quedó desactualizado.
- **Al cerrar un gap**: actualizar el estado en el `REQUIREMENTS.md` del sistema correspondiente
  (no solo acá) y quitar la fila de la tabla de gaps si ya no aplica.

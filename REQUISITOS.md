# Requisitos del ecosistema SICSAFT — índice consolidado

> Este documento **no repite** el contenido de cada `REQUIREMENTS.md` (metodología AI-DLC,
> `CLAUDE.md`) — resume ID, resumen de una línea y estado real, y enlaza a la fuente. Si el
> resumen y la fuente entran en conflicto, gana la fuente. Estado verificado contra el código el
> 2026-08-14, en la misma sesión que cerró Fase 4 y completó Fase 5 (ver `ROADMAP.md`).

## Por sistema

| Sistema | Fuente | Alcance | RF | RNF | Estado |
|---|---|---|---|---|---|
| APP QR | [`app-qr-sicsaft/aidlc-docs/requirements/REQUIREMENTS.md`](app-qr-sicsaft/aidlc-docs/requirements/REQUIREMENTS.md) | MVP demo standalone (histórico — superado por TASK-007) | 11 | 4 | ✅ Completo (demo original) |
| CORE | [`core/aidlc-docs/requirements/REQUIREMENTS.md`](core/aidlc-docs/requirements/REQUIREMENTS.md) | Fase 2 (Orquestador + 4 motores de lectura) | 7 | 5 | ✅ Completo, 2 parciales (RF-05, RNF-01), ambos YAGNI/bajo riesgo deliberado — ver detalle |
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
| CORE | RNF-01 | 5 endpoints nuevos de Fase 5 no paginan (`/contratos`, `/auditoria`, `/areas`, `/ubicaciones`, `/responsables`) — devuelven array plano, no `{items, total}` como `GET /catalogo` | Aceptado por volumen bajo de datos reales hoy. Cerrarlo es un cambio de contrato (rompe la forma de respuesta que CIS y WEB ya consumen como array) — alcance similar al de RF-05/RF-06 de WEB recién cerrados, no un fix trivial. Pendiente de decisión: ¿se prioriza ahora o se revisa cuando haya más de una organización con datos reales? |
| APP QR | RNF-01/RNF-02 | Sin validar en dispositivo Android físico (offline real, PWA instalable) | Fuera de alcance de este repositorio — requiere una persona con un teléfono real; ningún cambio de código lo cierra. Queda anotado como bloqueado en acción humana, no como deuda técnica |

**Cerrado 2026-08-14**:
- ~~WEB RF-06 — `GET /auditoria` sin filtro~~. `AuditoriaRepository.listar` (CORE) ganó filtros por
  `usuario`/`operacion` (`ILIKE '%valor%'`) y rango `fechaDesde`/`fechaHasta`; `AuditoriaPage`
  (WEB) agregó el formulario correspondiente. Verificado con unit + e2e reales contra Postgres.
- ~~WEB RF-05 — sin edición de Área/Ubicación~~. `AreaRepository.actualizar`/
  `UbicacionRepository.actualizar` (CORE) agregan `PATCH /areas/:id`/`PATCH /ubicaciones/:id`,
  incluida la asignación de `responsable_id`/`ubicacion_principal_id` a un Área; puente en CIS
  (`PATCH /admin/areas/:id`, `PATCH /admin/ubicaciones/:id`) y formularios de edición en
  `EstructuraPage` (WEB). Verificado con unit + e2e reales contra Postgres.
- ~~WEB RNF-05 — accesibilidad sin verificar~~. Contraste calculado real (compositing de opacidad
  incluido) contra la fórmula WCAG 2.1 para cada color/fondo del sistema de diseño. Encontró y
  corrigió un hallazgo real: el badge de estado `vencido`/fallback tenía 3.50:1 de contraste
  efectivo (bajo el mínimo AA de 4.5:1) — corregido a 6.64:1. El resto del sistema de color ya
  pasaba AA cómodamente (4.1–18:1 según par texto/fondo).

## Cómo se usa este índice

- **Para trabajar en un sistema**: leer su `REQUIREMENTS.md` completo — este índice es un resumen
  de navegación, no la fuente de verdad.
- **Para saber qué falta del roadmap**: cruzar la tabla de gaps de arriba con
  [`ROADMAP.md`](ROADMAP.md) § "Próximo paso sugerido" de cada sistema — los dos deberían decir lo
  mismo; si divergen, uno de los dos quedó desactualizado.
- **Al cerrar un gap**: actualizar el estado en el `REQUIREMENTS.md` del sistema correspondiente
  (no solo acá) y quitar la fila de la tabla de gaps si ya no aplica.

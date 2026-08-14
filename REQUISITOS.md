# Requisitos del ecosistema SICSAFT — índice consolidado

> Este documento **no repite** el contenido de cada `REQUIREMENTS.md` (metodología AI-DLC,
> `CLAUDE.md`) — resume ID, resumen de una línea y estado real, y enlaza a la fuente. Si el
> resumen y la fuente entran en conflicto, gana la fuente. Estado verificado contra el código el
> 2026-08-14, en la misma sesión que cerró Fase 4 y completó Fase 5 (ver `ROADMAP.md`).

## Por sistema

| Sistema | Fuente | Alcance | RF | RNF | Estado |
|---|---|---|---|---|---|
| APP QR | [`app-qr-sicsaft/aidlc-docs/requirements/REQUIREMENTS.md`](app-qr-sicsaft/aidlc-docs/requirements/REQUIREMENTS.md) | MVP demo standalone (histórico — superado por TASK-007) | 11 | 4 | ✅ Completo (demo original) |
| CORE | [`core/aidlc-docs/requirements/REQUIREMENTS.md`](core/aidlc-docs/requirements/REQUIREMENTS.md) | Fase 2 (Orquestador + 4 motores de lectura) | 7 | 5 | ✅ Completo, 2 parciales (RF-05, RNF-01) — ver detalle |
| WEB | [`web/aidlc-docs/requirements/REQUIREMENTS.md`](web/aidlc-docs/requirements/REQUIREMENTS.md) | Fase 5 (Portal WEB, 6 módulos) | 8 | 5 | ✅ 6/6 módulos, 2 parciales (RF-05, RF-06) — ver detalle |
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
| WEB | RF-06 | `GET /auditoria` no tiene ningún filtro (usuario/fecha/operación) — el requisito lo pide explícito, se construyó solo el listado sin filtrar | Con más de 200 registros el listado deja de ser útil; requiere query params nuevos en `AuditoriaRepository.listar` + controles en `AuditoriaPage` |
| WEB | RF-05 | Sin `PATCH /areas/:id` ni `PATCH /ubicaciones/:id` (edición); sin forma de asignar `responsable_id`/`ubicacion_principal_id` a un Área ya creada | El requisito pide "ABM completo" — hoy es "A" (alta) + "B" parcial (solo Responsable) + consulta, sin "M" real de Área/Ubicación |
| CORE | RF-05 | Traslado y cambio de ubicación/estado de Activo sin controller HTTP (el repository ya tiene los métodos) | Documentado como YAGNI (sin consumidor real) — riesgo bajo, pero el RF original no lo excluye explícitamente |
| CORE | RNF-01 | 5 endpoints nuevos de Fase 5 no paginan (`/contratos`, `/auditoria`, `/areas`, `/ubicaciones`, `/responsables`) | Aceptado por volumen bajo de datos reales hoy; revisar cuando haya más de una organización con datos reales |
| WEB | RNF-05 | Accesibilidad nunca auditada con herramienta (axe/Lighthouse); contraste AA no confirmado formalmente | El requisito pide verificación explícita, no solo intención de diseño |

## Cómo se usa este índice

- **Para trabajar en un sistema**: leer su `REQUIREMENTS.md` completo — este índice es un resumen
  de navegación, no la fuente de verdad.
- **Para saber qué falta del roadmap**: cruzar la tabla de gaps de arriba con
  [`ROADMAP.md`](ROADMAP.md) § "Próximo paso sugerido" de cada sistema — los dos deberían decir lo
  mismo; si divergen, uno de los dos quedó desactualizado.
- **Al cerrar un gap**: actualizar el estado en el `REQUIREMENTS.md` del sistema correspondiente
  (no solo acá) y quitar la fila de la tabla de gaps si ya no aplica.

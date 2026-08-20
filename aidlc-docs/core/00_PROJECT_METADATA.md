# Project Metadata — SICSAFT CORE, Fase 2 (Motor Patrimonial MVP)

**Sistema:** SICSAFT CORE (SYS-03) — `core/`
**Ciclo:** ROADMAP.md Fase 2 — "CORE MVP: Orquestador + 4 motores de lectura"
**Metodología:** AI-DLC (mismo patrón que `aidlc-docs/app-qr-sicsaft/`, primer sistema backend
que lo adopta — ver `CLAUDE.md` Documentación)
**Fecha:** 2026-08-13
**Fase actual:** Construction completa — código real implementado y verificado sobre este diseño.

## Status

- [x] Inception — requirements, domain model, arquitectura y contratos de API diseñados antes de
      escribir código (pedido explícito del usuario).
- [x] Construction — implementado: Orquestador, Motor Patrimonial (`GET /catalogo`), Motor de
      Reglas (`clasificarEscaneo`), Motor de Eventos, Motor de Auditoría, `POST /inventarios` +
      `GET /inventarios/:id/estado` idempotentes. 96 tests (100% stmts/lines/funcs), e2e contra
      Postgres real, verificado en `docker build`/`docker run` real. Ver `core/README.md` Estado.
- [ ] Operations — pendiente (sin deploy real todavía, ver `devops/README.md`).

## Por qué este directorio existe

`ROADMAP.md` ya traía la Fase 2 esbozada a nivel de lista ("qué se construye"/"done"), pero sin el
detalle de contrato de API, modelo de orquestación ni diagramas necesarios para implementar sin
adivinar decisiones sobre la marcha. Este directorio es ese detalle, con la misma disciplina que
`base-patrimonial/DOC-004`/`DOC-005`: diseño primero, revisado, **después** código.

## Quick Links

- Intent: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requirements: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Historias de usuario: [`story-artifacts/USER_STORIES.md`](story-artifacts/USER_STORIES.md)
- Modelo de dominio (orquestación): [`design-artifacts/DOMAIN_MODEL.md`](design-artifacts/DOMAIN_MODEL.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Contrato de API CIS↔CORE: [`design-artifacts/DOC-006-api-cis-core.md`](design-artifacts/DOC-006-api-cis-core.md)
- Orquestador: [`design-artifacts/DOC-007-arquitectura-core.md`](design-artifacts/DOC-007-arquitectura-core.md)
- Motor Patrimonial: [`design-artifacts/DOC-008-motor-patrimonial.md`](design-artifacts/DOC-008-motor-patrimonial.md)
- Motor de Reglas: [`design-artifacts/DOC-009-motor-reglas.md`](design-artifacts/DOC-009-motor-reglas.md)
- Motor de Eventos: [`design-artifacts/DOC-010-motor-eventos.md`](design-artifacts/DOC-010-motor-eventos.md)
- Motor de Auditoría: [`design-artifacts/DOC-011-motor-auditoria.md`](design-artifacts/DOC-011-motor-auditoria.md)
- Estrategia de testing: [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)

## Nota — Fase 4 agregó código a este mismo `core/`, con diseño en otro lado

Este directorio documenta específicamente la Fase 2 (Motor Patrimonial MVP, lectura). La Fase 4
(Administrador Patrimonial, escritura oficial) agregó código real a los mismos módulos
(`src/patrimonial/`, `src/orquestador/`) — `POST /activos`, `POST /activos/:id/baja`,
`POST /activos/:id/reincorporacion`, `PATCH /activos/:id/responsable` — pero su diseño **no**
vive acá: al ser una capacidad transversal de seguridad/permisos (Usuario → Rol → Organización),
el DOC-XXX correspondiente (DOC-012) se documentó en
[`seguridad/DOC-012-administrador-patrimonial.md`](../../seguridad/DOC-012-administrador-patrimonial.md),
no en `aidlc-docs/core/`, siguiendo el mismo criterio que ya usa `base-patrimonial/DOC-004`/
`DOC-005` (el dominio del documento determina dónde vive, no dónde termina el código). Ver
`core/README.md` Estado para el resumen de qué de DOC-012 ya está implementado acá.

## Notas del análisis

- Estos DOC-XXX ya estaban *citados* como pendientes en `core/README.md` "Documentos
  relacionados" desde la Fase 0 — este directorio les da contenido real, no cambia su numeración.
- El diseño reutiliza sin reinterpretar: el vocabulario de las 8 categorías de escaneo
  (`base-patrimonial/DOC-005-modelo-patrimonial.md` 5) y la lógica hoy vive del lado del cliente
  en `app-qr-sicsaft/src/lib/scan-resolve.ts` — este diseño es, en gran parte, la especificación
  de mover esa lógica a CORE sin cambiarle el comportamiento observable.
- El contrato de API (DOC-006) no inventa formas nuevas: se diseñó para que
  `cis/src/qr-connector/qr-connector.types.ts` (ya escrito, hoy sirviendo datos mock) siga siendo
  válido tal cual — CIS es un proxy delgado hacia CORE, no debería necesitar cambiar sus tipos.

# Project Metadata — Portal WEB SICSAFT (Fase 5)

**Sistema:** Portal WEB SICSAFT (SYS-05) — `web/`
**Ciclo:** ROADMAP.md Fase 5 — "Portal WEB mínimo"
**Metodología:** AI-DLC (tercer sistema que lo adopta, después de `app-qr-sicsaft/aidlc-docs/` y
`core/aidlc-docs/`)
**Fecha:** 2026-08-13 (diseño), 2026-08-14 (primer incremento de código)
**Fase actual:** Construction — login + módulo Activos implementados y verificados de punta a
punta; resto de los módulos del MVP sin construir (ver `web/README.md` § Estado).

## Status

- [x] Inception — requirements, historias, arquitectura, DOC-013 y un mockup visual diseñados en
      la sesión de Fase 2.
- [x] Construction — en curso: login OIDC/PKCE real + módulo Activos (consulta + alta) ya
      implementados y verificados contra Postgres real. Faltan Inventarios,
      Áreas/Ubicaciones/Responsables, Auditoría, Contratos y el empaquetado Docker/CI.
- [ ] Operations — pendiente.

## Por qué este directorio existe ahora, adelantado

El usuario pidió explícitamente diseñar (no construir) el Portal WEB durante la sesión de diseño
de Fase 2, para dejar la "parte visual" del ecosistema planificada de punta a punta. El código
empezó recién en la sesión del 2026-08-14, una vez que Fase 3 (CIS real) y Fase 4 (Administrador
Patrimonial) ya estaban completas (`web/README.md` § Depende de).

## Quick Links

- Intent: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requirements: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Historias de usuario: [`story-artifacts/USER_STORIES.md`](story-artifacts/USER_STORIES.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Contrato formal: [`design-artifacts/DOC-013-portal-web.md`](design-artifacts/DOC-013-portal-web.md)
- Estrategia de testing: [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)
- Mockup visual: Artifact publicado en esta sesión (hub + módulos, paleta `BRAND.md`) — sin
  archivo en el repo, ver enlace compartido en la conversación.

## Notas del análisis

- Alcance recortado a los **6 módulos MVP** que `ROADMAP.md` Fase 5 ya definió, no a los 17
  "módulos previstos" que lista `web/README.md` a largo plazo — modelar los otros 11 sin
  consumidor sería diseño especulativo (mismo criterio YAGNI de DOC-005/DOC-006).
- No se diseña un dominio propio: WEB es un **cliente** del mismo contrato CIS/CORE que APP QR
  (`ARQUITECTURA-WAF.md` §8, "Portal WEB y APP QR son clientes intercambiables del mismo
  contrato") — reusa DOC-002/DOC-006, no inventa endpoints nuevos.

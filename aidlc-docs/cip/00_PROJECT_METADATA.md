# CIP (SYS-06) — Metadata del proyecto

## Fase AI-DLC actual
**Operations** (incremento base) **+ Construction** (inteligencia decisional). El dashboard base
(DOC-014/DOC-018) y las alertas entrelazadas con historial nocturno (DOC-034) están implementados
y verificados con Postgres real — `cip/` es un backend NestJS real, no un mock (ver
`cip/README.md`). DOC-026 (inteligencia decisional, 8 preguntas) sigue siendo **solo diseño, sin
código** — es el próximo incremento de Construction.

**Primera escritura de CIP**: el endpoint `PATCH /dashboard/sesiones/:sesionId/revisar` (marca una
sesión como revisada desde el organigrama del Directivo) ya está documentado en
[`DOC-036-marcar-sesion-revisada-cip.md`](DOC-036-marcar-sesion-revisada-cip.md).

## Quick links
- Intent: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requisitos: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Historias de usuario: [`story-artifacts/USER_STORIES.md`](story-artifacts/USER_STORIES.md)
- Modelo de dominio: [`design-artifacts/DOMAIN_MODEL.md`](design-artifacts/DOMAIN_MODEL.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Contrato formal del dashboard base: [`design-artifacts/DOC-014-cip-dashboard.md`](design-artifacts/DOC-014-cip-dashboard.md)
- Servicio NestJS, migraciones, worker y API: [`design-artifacts/DOC-018-cip-servicio-nestjs.md`](design-artifacts/DOC-018-cip-servicio-nestjs.md)
- Inteligencia decisional (8 preguntas, solo diseño): [`design-artifacts/DOC-026-cip-inteligencia-decisional.md`](design-artifacts/DOC-026-cip-inteligencia-decisional.md)
- Alertas entrelazadas + historial nocturno: [`design-artifacts/DOC-034-alertas-entrelazadas-reportes.md`](design-artifacts/DOC-034-alertas-entrelazadas-reportes.md)
- Marcar sesión revisada (primera escritura de CIP): [`design-artifacts/DOC-036-marcar-sesion-revisada-cip.md`](design-artifacts/DOC-036-marcar-sesion-revisada-cip.md)
- Estrategia de testing: [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)

## Checklist de Inception (incremento base, cerrado)
- [x] Intent (qué se pide, por qué ahora, qué NO es esta fase)
- [x] Requirements (RF/RNF con ID y fuente)
- [x] User stories (perspectiva Administrador Patrimonial / Gestión de Permisos)
- [x] Domain model (entidades de lectura + diagrama)
- [x] Architecture (outbox, vistas materializadas, límites de módulo)
- [x] Confirmación del usuario — pasó a Construction y luego a Operations (DOC-018, DOC-034)

## Fuentes citadas
- Tomo IV Cap. 2 (Motor de Alertas/Reportes, Gestión Documental — fuera de alcance de este
  incremento).
- `PROCESO MODULAR DE APLICACION SICSAFT, SOFTWARE.ppt` (spec funcional, fuera de git, 2026-08-17)
  — confirma gráfico circular por categoría de AFT y el informe diario automático.
- [`ARQUITECTURA-WAF.md`](../../ARQUITECTURA-WAF.md) 5 (rendimiento — separar lectura analítica
  de la transaccional), 8 (contrato de módulo aplicado a CIP), 9 (anti-sobre-ingeniería — no
  elegir motor analítico antes de tener el modelo de CORE estable).
- [`ROADMAP.md`](../../ROADMAP.md) Fase 6.
- [`cip/README.md`](../../cip/README.md).

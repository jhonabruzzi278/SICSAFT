# CIP (SYS-06) — Metadata del proyecto

## Fase AI-DLC actual
**Inception** — requirements, historias, modelo de dominio y arquitectura en diseño. Sin código
todavía (ver `ROADMAP.md` Fase 6, `cip/README.md` Estado: 🔲 No iniciado).

## Quick links
- Intent: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requisitos: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Historias de usuario: [`story-artifacts/USER_STORIES.md`](story-artifacts/USER_STORIES.md)
- Modelo de dominio: [`design-artifacts/DOMAIN_MODEL.md`](design-artifacts/DOMAIN_MODEL.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Contrato formal: [`design-artifacts/DOC-014-cip-dashboard.md`](design-artifacts/DOC-014-cip-dashboard.md)
  (número ya reservado en `cip/README.md`/`ROADMAP.md`)
- Contrato de implementación del segundo incremento (servicio `cip/`, migraciones, worker, API):
  [`design-artifacts/DOC-018-cip-servicio-nestjs.md`](design-artifacts/DOC-018-cip-servicio-nestjs.md)
- Estrategia de testing: [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)

## Checklist de Inception
- [x] Intent (qué se pide, por qué ahora, qué NO es esta fase)
- [x] Requirements (RF/RNF con ID y fuente)
- [x] User stories (perspectiva Administrador Patrimonial / Gestión de Permisos)
- [x] Domain model (entidades de lectura + diagrama)
- [x] Architecture (outbox, vistas materializadas, límites de módulo)
- [ ] Confirmación del usuario antes de pasar a Construction

## Fuentes citadas
- Tomo IV Cap. 2 (Motor de Alertas/Reportes, Gestión Documental — fuera de alcance de este
  incremento).
- `PROCESO MODULAR DE APLICACION SICSAFT, SOFTWARE.ppt` (spec funcional, fuera de git, 2026-08-17)
  — confirma gráfico circular por categoría de AFT y el informe diario automático.
- [`ARQUITECTURA-WAF.md`](../../ARQUITECTURA-WAF.md) 5 (rendimiento — separar lectura analítica
  de la transaccional), 8 (contrato de módulo aplicado a CIP), 9 (anti-sobre-ingeniería — no
  elegir motor analítico antes de tener el modelo de CORE estable).
- [`ROADMAP.md`](../../ROADMAP.md) Fase 6.
- [`cip/README.md`](../README.md).

# Project Metadata — SICSAFT CORE (SYS-03)

**Sistema:** SICSAFT CORE (`core/`)  
**Tipo:** Backend NestJS — Orquestador Patrimonial y Motor BPI  
**Fase AI-DLC:** Construction completa (CI verde, cobertura 100 %) e integrada en Stage 1 y Stage 2; Gate pendiente de verificación en cliente  
**Última actualización:** 2026-09-10  
**Gobernanza:** Conforme a [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)

---

## Estado

- [x] **Inception Phase**: Modelo de dominio patrimonial ([`DOMAIN_MODEL.md`](design-artifacts/DOMAIN_MODEL.md)), contratos de API y arquitectura de motores.
- [x] **Construction Phase**: **100% implementado y verificado**:
  - Orquestador y 4 motores centrales: Patrimonial ([`DOC-008`](design-artifacts/DOC-008-motor-patrimonial.md)), Reglas ([`DOC-009`](design-artifacts/DOC-009-motor-reglas.md)), Eventos ([`DOC-010`](design-artifacts/DOC-010-motor-eventos.md)) y Auditoría ([`DOC-011`](design-artifacts/DOC-011-motor-auditoria.md)).
  - API CIS↔CORE ([`DOC-006`](design-artifacts/DOC-006-api-cis-core.md)): sesiones de inventario idempotentes en Postgres real.
  - Escritura Oficial (Fase 4, [`DOC-012`](../../seguridad/DOC-012-administrador-patrimonial.md)): 7 endpoints de mutación oficial (alta/baja/reincorporación/responsable de activo, importación masiva).
  - CRUD de Entidades Estructurales ([`DOC-024`](../ccp/design-artifacts/DOC-024-crud-completo-auditoria-identidad.md)): Organización, Sede y Contrato con máquina de estados bidireccional (invariante: nunca DELETE físico).
  - Ingesta Contable y Control ([`DOC-029`](../ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md)): Bandeja de staging con resolución automática de jerarquías (`resuelve-o-crea`), `GET /inventarios/:id/control` (Pantalla 8) y campos extendidos de inventario.
  - Publicación asíncrona de eventos de dominio a `pg-boss` para consumo desacoplado por CIP (ADR-005).
  - Cobertura de tests unitarios al **100% de líneas y funciones** en Jest; tests e2e contra Postgres real.
- [x] **Operations Phase**:
  - División de deployables (ADR-003): backend NestJS en `core/` y portal Directivo SPA en `core/frontend/`.
  - Integración nativa en `sicsaft-core.exe` y `devops/onprem/` sobre PostgreSQL 16 con migraciones automáticas (`node-pg-migrate`).

---

## Quick Links

- Gobernanza de etapas: [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)
- Intent: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requirements: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Historias de usuario: [`story-artifacts/USER_STORIES.md`](story-artifacts/USER_STORIES.md)
- Modelo de dominio: [`design-artifacts/DOMAIN_MODEL.md`](design-artifacts/DOMAIN_MODEL.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Contrato de API CIS↔CORE: [`design-artifacts/DOC-006-api-cis-core.md`](design-artifacts/DOC-006-api-cis-core.md)
- Orquestador: [`design-artifacts/DOC-007-arquitectura-core.md`](design-artifacts/DOC-007-arquitectura-core.md)
- Motores de negocio: [`DOC-008`](design-artifacts/DOC-008-motor-patrimonial.md), [`DOC-009`](design-artifacts/DOC-009-motor-reglas.md), [`DOC-010`](design-artifacts/DOC-010-motor-eventos.md), [`DOC-011`](design-artifacts/DOC-011-motor-auditoria.md)
- Estrategia de testing: [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)

---

## Regla no negociable de persistencia

Único componente del ecosistema autorizado a mutar la **BPI (Base Patrimonial Inteligente)**. Ninguna fuente de captura (APP QR, CCP, RFID) escribe directo a la base de datos sin pasar por CIS → CORE.

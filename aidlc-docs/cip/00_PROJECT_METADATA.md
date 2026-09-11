# CIP (SYS-06) — Centro de Inteligencia Patrimonial — Metadata del proyecto

**Sistema:** Centro de Inteligencia Patrimonial (`cip/`)  
**Tipo:** Microservicio NestJS asíncrono (Worker `pg-boss`, base Postgres analítica propia)  
**Fase AI-DLC:** Construction completa (CI verde, cobertura 100 %) e integrada en Stage 2; Gate 2 pendiente de verificación en cliente  
**Última actualización:** 2026-09-10  
**Gobernanza:** Conforme a [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)

---

## Estado

- [x] **Inception Phase**: Requisitos analíticos, casos de uso de explotación directiva y modelo de dominio analítico diseñados.
- [x] **Construction Phase**: **100% implementado y verificado**:
  - Worker de agregación asíncrona sobre PostgreSQL usando `pg-boss` (ADR-005, reemplaza a Redis) consumiendo eventos de la cola `cip-eventos`.
  - Base de datos analítica Postgres dedicada y versionada con `node-pg-migrate` (`cip/migrations/`).
  - 8 endpoints de consulta analítica de alta velocidad:
    - `GET /dashboard/cobertura` (porcentaje de cobertura y avance)
    - `GET /dashboard/areas` (resumen por área operativa)
    - `GET /dashboard/sesiones` (sesiones con veredicto calculado)
    - `GET /dashboard/no-localizados` (bienes no localizados)
    - `GET /dashboard/incidencias` (resumen de incidencias)
    - `GET /dashboard/estado-aft` (bienes en servicio, inactivos, baja)
    - `GET /dashboard/categorias` (distribución por categorías)
    - `GET /dashboard/resumen` (resumen integral consolidado)
  - Veredicto patrimonial canónico cuatripartito blindado por test de contrato cruzado (`cip/src/agregacion/veredicto.spec.ts`).
  - Cobertura de pruebas unitarias/integración al **100% de líneas y funciones** en Jest (26 suites).
  - Integración con CIS (`cis/src/dashboard-connector/`) protegida por `CIP_SERVICE_TOKEN`.
- [x] **Operations Phase**:
  - Activación condicional por nivel: en Nivel 1 se omite su ejecución para ahorrar ~120MB de RAM (`CIP-05`); en Nivel 2 se orquesta automáticamente por `sicsaft-core.exe` y `devops/onprem/`.

---

## Quick links

- Gobernanza de etapas: [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)
- Intent: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requisitos: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Historias de usuario: [`story-artifacts/USER_STORIES.md`](story-artifacts/USER_STORIES.md)
- Modelo de dominio: [`design-artifacts/DOMAIN_MODEL.md`](design-artifacts/DOMAIN_MODEL.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Contrato formal de API: [`design-artifacts/DOC-014-cip-dashboard.md`](design-artifacts/DOC-014-cip-dashboard.md)
- Especificación del servicio NestJS: [`design-artifacts/DOC-018-cip-servicio-nestjs.md`](design-artifacts/DOC-018-cip-servicio-nestjs.md)
- Inteligencia decisional: [`design-artifacts/DOC-026-cip-inteligencia-decisional.md`](design-artifacts/DOC-026-cip-inteligencia-decisional.md)
- Estrategia de testing: [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)

---

## Dependencias

- **CORE** (`core/`): Publicación de eventos de dominio patrimonial en `pg-boss`.
- **CIS** (`cis/`): Proxy de consulta para los portales frontends con validación OIDC.
- **Postgres**: Base de datos dedicada para vistas analíticas.

# DevOps — Infraestructura On-Premise y Release — Metadata del proyecto

**Sistema:** `devops/` (Capacidad transversal — OPS)  
**Fase AI-DLC:** Operations — stack e instaladores construibles para Stage 1 y Stage 2; sin despliegue en cliente todavía (Gate 1/2 pendientes)  
**Última actualización:** 2026-09-10  
**Gobernanza:** Conforme a [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)

---

## Estado

- [x] **Inception Phase**: Diseño del instalador on-premise por cliente y definición de niveles de producto ([`DOC-025`](design-artifacts/DOC-025-niveles-producto-onprem.md)).
- [x] **Construction Phase**:
  - Implementación del stack `devops/onprem/` sobre Podman / Docker Compose con Keycloak 26 (ADR-004) y PostgreSQL 16.
  - Script de instalación desatendida y parametrizada: `instalar-cliente.ps1 -Nivel 1|2`.
  - Retiro formal de stacks `devops/local` y `devops/prod` ([DOC-032](../revision-codigo/DOC-032-revision-de-codigo-y-documentacion.md) H-01, ver `ROADMAP.md`): consolidación del 100% de la infraestructura en el modelo On-Premise / Desktop.
- [x] **Operations Phase**:
  - Coexistencia con `sicsaft-core/`: empaquetado nativo en `.exe` (Electron / NSIS) con binarios vendorizados de Postgres 16 y Keycloak 26 para clientes finales en PCs de escritorio Windows sin requerir Docker ni WSL2.

---

## Quick links

- Gobernanza de etapas: [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)
- Intención: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requisitos: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Arquitectura On-Premise: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Niveles de producto: [`design-artifacts/DOC-025-niveles-producto-onprem.md`](design-artifacts/DOC-025-niveles-producto-onprem.md)
- README operativo: [`devops/README.md`](../../devops/README.md)
- Carpeta On-Premise: [`devops/onprem/`](../../devops/onprem)

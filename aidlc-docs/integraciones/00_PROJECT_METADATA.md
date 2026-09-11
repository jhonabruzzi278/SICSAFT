# Metadata — Integraciones / Ingesta Contable

**Fase AI-DLC:** Construction Completa (Implementada vía DOC-029 en STAGE 1 y STAGE 2)  
**Gobernanza:** Conforme a [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)

**Implementación oficial**: La ingesta contable institucional opera mediante el modelo supervisado de DOC-029:
- **Sidecar ETL**: [`herramientas/etl-contable/`](../../herramientas/etl-contable/) (Python 3.12, `pandas`, `xlrd`).
- **Bandeja de Staging**: CORE (`sesiones_inventario` y staging de activos en Postgres).
- **Aprobación Humana**: CCP (`ccp/src/pages/ImportacionesPage.tsx`), respetando el principio no negociable de Tomo III: el Profesional de AFT no es una integración automática desatendida; revisa y aprueba el lote con su identidad real.

## Quick links

- [DOC-029](../../aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) — Endurecimiento e ingesta contable real (RF-B).
- [INTENT.md](requirements/INTENT.md) — contexto original.
- [DOC-016](design-artifacts/DOC-016-conector-con-contabilidad.md) — diseño conceptual previo (superado por el modelo supervisado DOC-029).
- [ETL Contable README](../../herramientas/etl-contable/README.md) — documentación operativa.

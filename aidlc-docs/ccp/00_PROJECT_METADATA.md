# Project Metadata — Portal WEB SICSAFT (Fase 5)

> **Corrección (2026-09).** DOC-021 (rol `administrador-sistema`) y DOC-022 (portal `web_admin/`)
> se **revirtieron**: el rol, el portal y sus endpoints de CIS/CORE se eliminaron por completo.
> El CRUD de Organización/Contrato/Sede y la asignación de usuarios pasó a intervención directa
> del proveedor externo (BD / script con service-token) + el bootstrap del wizard de
> `sicsaft-core`; el diagnóstico de errores lo hace el soporte por la consola de logs en
> pantalla. Quedan **dos** portales WEB: `ccp/` (Profesional de AFT) y `core/frontend/` (Directivo).

**Sistema:** Portal WEB SICSAFT (SYS-05) — `ccp/`
**Ciclo:** ROADMAP.md Fase 5 — "Portal WEB mínimo"
**Metodología:** AI-DLC (tercer sistema que lo adopta, después de `aidlc-docs/app-qr-sicsaft/` y
`aidlc-docs/core/`)
**Fecha:** 2026-08-13 (diseño), 2026-08-14 (primer incremento de código), 2026-08-18 (diseño y
construcción del séptimo módulo, Dashboard/CIP — DOC-019; mismo día, diseño y construcción de la
segmentación por rol Directivo — DOC-020; mismo día, diseño de cierre de gaps del CCP + rol
Administrador del Sistema — DOC-021; mismo día, diseño de la reestructuración de portales — CCP/
`web_admin`/frontend de CORE — DOC-022)
**Fase actual:** Construction completa (CI verde) e integrada en Stage 1 y Stage 2; Gate 1/Gate 2 pendientes de verificación en cliente  
**Gobernanza:** Conforme a [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)

## Status

- [x] Inception — requirements, historias, arquitectura, DOC-013 y mockup visual completados.
- [x] Construction — MVP de Fase 5 (6 módulos) completo:
  - Activos: consulta y alta manual de activos patrimoniales.
  - Estructura: Áreas, Ubicaciones y Responsables con asignación cruzada.
  - Ingesta Contable (DOC-029 RF-B): revisión y aprobación de lotes Excel procesados por ETL Python.
  - QR/Etiquetas (DOC-029 RF-F): generación e impresión de etiquetas QR y Code 128.
  - Auditoría: consulta filtrable por usuario, fecha, operación y área con columna "Revisar".
  - Resumen post-inventario (DOC-029 RF-I, Pantalla 8).
  - Dashboard analítico CIP (DOC-019): integrado y gateado a Nivel 2 mediante `VITE_SICSAFT_NIVEL=2`.
  - Autenticación OIDC/PKCE verificada contra Keycloak 26 (ADR-004).
  - Reestructuración de portales (DOC-022): exclusivo del Profesional AFT (`administrador-patrimonial`); el Directivo usa `core/frontend/` y `web_admin/` fue formalmente eliminado (2026-09).
- [~] Operations — servido On-Premise en `127.0.0.1:8766` por `sicsaft-core.exe` (portal embebido) y en `<ip-lan>:8767` para el puesto del AFT (Fase G), además de por Podman en `devops/onprem/`. Sin despliegue en cliente todavía (Gate pendiente).

## Por qué este directorio existe ahora, adelantado

El usuario pidió explícitamente diseñar (no construir) el Portal WEB durante la sesión de diseño
de Fase 2, para dejar la "parte visual" del ecosistema planificada de punta a punta. El código
empezó recién en la sesión del 2026-08-14, una vez que Fase 3 (CIS real) y Fase 4 (Administrador
Patrimonial) ya estaban completas (`ccp/README.md` Depende de).

## Quick Links

- Intent: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requirements: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Historias de usuario: [`story-artifacts/USER_STORIES.md`](story-artifacts/USER_STORIES.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Contrato formal: [`design-artifacts/DOC-013-portal-web.md`](design-artifacts/DOC-013-portal-web.md)
- Séptimo módulo (Dashboard/CIP): [`design-artifacts/DOC-019-dashboard-cip-frontend.md`](design-artifacts/DOC-019-dashboard-cip-frontend.md)
- Segmentación por rol (Directivo): [`design-artifacts/DOC-020-segmentacion-por-rol-directivo.md`](design-artifacts/DOC-020-segmentacion-por-rol-directivo.md)
- Cierre de gaps del CCP + Administrador del Sistema: [`design-artifacts/DOC-021-cobertura-ccp-y-administrador-sistema.md`](design-artifacts/DOC-021-cobertura-ccp-y-administrador-sistema.md)
- Reestructuración de portales (CCP/`web_admin`/frontend de CORE): [`design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md`](design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
- Estrategia de testing: [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)
- Mockup visual: Artifact publicado en esta sesión (hub + módulos, paleta `BRAND.md`) — sin
  archivo en el repo, ver enlace compartido en la conversación.

## Notas del análisis

- Alcance recortado a los **6 módulos MVP** que `ROADMAP.md` Fase 5 ya definió, no a los 17
  "módulos previstos" que lista `ccp/README.md` a largo plazo — modelar los otros 11 sin
  consumidor sería diseño especulativo (mismo criterio YAGNI de DOC-005/DOC-006).
- No se diseña un dominio propio: WEB es un **cliente** del mismo contrato CIS/CORE que APP QR
  (`ARQUITECTURA-WAF.md` 8, "Portal WEB y APP QR son clientes intercambiables del mismo
  contrato") — reusa DOC-002/DOC-006, no inventa endpoints nuevos.

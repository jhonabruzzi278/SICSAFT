# Project Metadata — Portal WEB SICSAFT (Fase 5)

**Sistema:** Portal WEB SICSAFT (SYS-05) — `ccp/`
**Ciclo:** ROADMAP.md Fase 5 — "Portal WEB mínimo"
**Metodología:** AI-DLC (tercer sistema que lo adopta, después de `app-qr-sicsaft/aidlc-docs/` y
`core/aidlc-docs/`)
**Fecha:** 2026-08-13 (diseño), 2026-08-14 (primer incremento de código), 2026-08-18 (diseño y
construcción del séptimo módulo, Dashboard/CIP — DOC-019; mismo día, diseño y construcción de la
segmentación por rol Directivo — DOC-020; mismo día, diseño de cierre de gaps del CCP + rol
Administrador del Sistema — DOC-021; mismo día, diseño de la reestructuración de portales — CCP/
`web_admin`/frontend de CORE — DOC-022)
**Fase actual:** Construction — los 9 módulos (6 del MVP de Fase 5 + Dashboard RF-09 +
Importaciones/Administración RF-14/RF-15) y RF-10 (segmentación por rol) tienen código
funcionando. RF-01/RF-09/RF-10 verificados de punta a punta contra Docker/Zitadel reales; RF-11 a
RF-15 (DOC-021) implementados con tsc/build/e2e en verde pero sin esa verificación real todavía
(pendiente — requiere crear el rol `administrador-sistema` y el service user PAT en Zitadel real,
ver `devops/local/README.md`).

## Status

- [x] Inception — requirements, historias, arquitectura, DOC-013 y un mockup visual diseñados en
      la sesión de Fase 2.
- [x] Construction — MVP de Fase 5 (6 módulos) completo. Incremento (Dashboard/CIP, DOC-019,
      2026-08-18): `src/dashboard-connector/` en CIS + `DashboardPage.tsx` en WEB implementados,
      verificados de punta a punta contra Docker real (login OIDC real, datos reales de CIP).
      Incremento (segmentación por rol, DOC-020, 2026-08-18): `esDirectivo()` en `oidc-client.ts` +
      bifurcación en `HubPage.tsx` implementados, verificados en el navegador (modo mock, 3 casos)
      y de punta a punta contra Docker/Zitadel reales (rol `directivo` creado en Zitadel, login
      real confirma el redirect automático a `/dashboard`).
- [ ] Operations — pendiente.
- [x] Construction — DOC-021 (cierre de gaps del CCP + Administrador del Sistema): diseñado y
      construido 2026-08-18 (4 fases: CORE, CIS, WEB, devops). Falta verificación real de punta a
      punta contra Docker/Zitadel (crear rol/service user reales).
- [ ] Construction — DOC-022 (reestructuración de portales: `ccp/` → `ccp/`, `web_admin/` nuevo,
      `core/frontend/` nuevo para el Directivo con gestión de roles acotada a su organización):
      diseñado 2026-08-18, en construcción (6 fases: diseño+ADR, rename, `web_admin/`, CIS
      `directivo/`, `core/frontend/`, cierre de docs).

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

# Project Metadata

**Project Name:** APP QR SICSAFT — Captura de inventario patrimonial vía QR (PWA)
**Owner:** jonathanguerra278@gmail.com
**Last Updated:** 2026-09-17
**Current Phase:** Construction avanzada (Operations parcial — empaquetada dentro del `.exe` de `sicsaft-core`, DOC-028 Fase D)

> **Nota histórica**: este archivo describía hasta 2026-09-17 un prototipo distinto y ya
> abandonado (sitio estático vanilla-JS de inventario de productos, sin `package.json`, del
> 2026-07-30). Ese prototipo fue reemplazado por completo por el proyecto actual: PWA
> React 19 + TypeScript + Vite + shadcn/ui, con login OIDC/PKCE real contra Keycloak, Conector QR
> real contra CIS→CORE, cola offline (IndexedDB) y CI real (`.github/workflows/app-qr-ci.yml`).
> `testing/TEST_COVERAGE_REPORT.md`, `deployment/DEPLOYMENT_CHECKLIST.md` y
> `operations/MONITORING_SETUP.md` quedaron reescritos junto con este archivo por la misma razón.

## Status
- [x] Inception Phase — completa (requirements, historias, ADR de rename `app-qr-sicsaft`).
- [x] Construction Phase — el flujo oficial de 12 pantallas (DOC-001) está completo, con las 10
  etapas de TASK-004 a TASK-010 implementadas: auth OIDC/PKCE, selección de organización/área/
  ubicación, escaneo, clasificación de 8 categorías, incidencias, resumen, envío real a CORE vía
  CIS y cola offline con reintento.
- [x] Operations parcial — se distribuye embebida en el `.exe` de `sicsaft-core` (servida como PWA
  local, DOC-028 Fase D) y tiene CI real (build + Playwright e2e con mocks MSW + `docker build`).
  Sin despliegue propio en Vercel (el único proyecto Vercel real del repo es `landing/`).

## Quick Links
- README del sistema: [`../../app-qr-sicsaft/README.md`](../../app-qr-sicsaft/README.md)
- Contexto de negocio y backlog: [`../../app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md`](../../app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md)
- Flujo oficial (12 pantallas): [`design-artifacts/DOC-001-flujo-oficial.md`](design-artifacts/DOC-001-flujo-oficial.md)
- Conector QR real: [`design-artifacts/DOC-002-conector-qr.md`](design-artifacts/DOC-002-conector-qr.md)
- Veredictos de sesión y brechas: [`design-artifacts/DOC-017-fase-3.1-brechas-flujo.md`](design-artifacts/DOC-017-fase-3.1-brechas-flujo.md)
- Dirección como nivel previo a Área en el selector: [`design-artifacts/DOC-033-direccion-jerarquia-de-area.md`](design-artifacts/DOC-033-direccion-jerarquia-de-area.md)
- Testing: [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)
- Deployment: [`deployment/DEPLOYMENT_CHECKLIST.md`](deployment/DEPLOYMENT_CHECKLIST.md)
- Operations: [`operations/MONITORING_SETUP.md`](operations/MONITORING_SETUP.md)

## Gaps conocidos (2026-09-17)
- Sin ESLint ni Vitest configurados (dos tests unitarios existentes, `verdict.test.ts` y
  `oidc/pkce.test.ts`, importan de `vitest` pero no corren en ningún lado — intento parcial
  abandonado, ver `testing/TEST_STRATEGY.md`).
- El e2e de CI corre contra mocks MSW (`src/mocks/`), no contra CIS/CORE real — la integración
  real de punta a punta se verifica en `casos-de-uso/e2e/` y en `sicsaft-core/e2e/`.

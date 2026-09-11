# Project Metadata — APP QR SICSAFT (SYS-01)

**Sistema:** APP QR SICSAFT (`app-qr-sicsaft/`)  
**Tipo:** PWA Móvil Instalable (React 19, Vite, Tailwind CSS v4, shadcn/ui)  
**Fase AI-DLC:** Operations / Release — construido e integrado en Stage 1 y Stage 2; Gate 1/Gate 2 pendientes de verificación en cliente (ver Gobernanza §4)  
**Última actualización:** 2026-09-10  
**Gobernanza:** Conforme a [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)

---

## Estado

- [x] **Inception Phase**: Flujo oficial de escaneo de 8 pasos ([`DOC-001`](design-artifacts/DOC-001-flujo-oficial.md)) y requisitos base.
- [x] **Construction Phase**: Implementado y verificado de punta a punta.
  - Migración a React 19 + shadcn/ui ([ADR-002](design-artifacts/ADR/ADR-002-react-shadcn-migration.md)).
  - TASK-007: Sincronización real de sesiones de inventario con CIS/CORE vía token OIDC PKCE (Keycloak 26).
  - Fase 3.1 ([`DOC-017`](design-artifacts/DOC-017-fase-3.1-brechas-flujo.md)): Selector de modo, veredicto de sesión (exitoso/aceptable/defectuoso), estado operativo y detección de AFT fuera de área.
  - Veredicto canónico cruzado con paridad blindada por tests de contrato ([`verdict.test.ts`](../../app-qr-sicsaft/src/lib/verdict.test.ts)).
  - 18 specs E2E con Playwright ejecutándose sobre build real.
- [x] **Operations Phase**:
  - Despliegue en nube: Vercel (`.vercel/repo.json`, proyecto `sicsaft`).
  - Despliegue local On-Premise: `sicsaft-core.exe` sirve la PWA por HTTPS en `https://<ip-lan>:8765` (`PUERTO_APP_QR`) con certificado **autofirmado** generado en runtime (`appqr-tls.ts`, lib `selfsigned`), cacheado en `userData`, con SAN de la IP de LAN y de `sicsaft.local` (alias mDNS, `discovery-service.ts` — marcado `FUT-04`). Al ser autofirmado, el navegador del teléfono muestra la advertencia de certificado en la primera visita (DOC-028).

---

## Quick Links

- Gobernanza de etapas: [`aidlc-docs/GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md)
- Requisitos oficiales: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Flujo oficial: [`design-artifacts/DOC-001-flujo-oficial.md`](design-artifacts/DOC-001-flujo-oficial.md)
- Conector QR: [`design-artifacts/DOC-002-conector-qr.md`](design-artifacts/DOC-002-conector-qr.md)
- Fase 3.1 (Brechas de flujo): [`design-artifacts/DOC-017-fase-3.1-brechas-flujo.md`](design-artifacts/DOC-017-fase-3.1-brechas-flujo.md)
- Estrategia de testing: [`testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)
- Backlog y handoff: [`app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md`](../../app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md)

---

## Depende de

- **CIS** (`cis/`): Autenticación OIDC vía Keycloak 26 y proxy hacia CORE (`POST /inventarios`, `GET /catalogo`).
- **SICSAFT CORE HOST** (`sicsaft-core/`): Servidor estático HTTPS de la PWA en `:8765` (`PUERTO_APP_QR`) y emisor mDNS (`sicsaft.local`) para entrega local. El CCP del puesto del AFT va aparte, en `:8767` (`PUERTO_CCP_LAN`, Fase G).

## Bloquea

- Nada — APP QR es la fuente primaria de captura en terreno de STAGE 1 y STAGE 2.

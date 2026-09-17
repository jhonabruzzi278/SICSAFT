# CIS (Centro de Interoperabilidad) — Metadata del Proyecto

> 📌 **Resumen Rápido (Lectura en 30s)**:
> - **¿Qué es?**: El **API Gateway y guardián de seguridad** de todo el ecosistema SICSAFT (NestJS, puerto 3000).
> - **Función Principal**: Es el **único punto de entrada expuesto** para las aplicaciones cliente (APP Móvil QR, Portal CCP, Portal Directivo y sidecar ETL). Ninguna aplicación externa habla directamente con la base de datos ni con CORE.
> - **Seguridad y Resiliencia**:
>   - Valida criptográficamente los tokens JWT emitidos por Keycloak 26.
>   - Valida todos los datos de entrada con esquemas Zod estrictos.
>   - Aplica protección contra sobrecarga (Rate Limiting y Circuit Breaker).
>   - Inyecta tokens de servicio interno para comunicarse de forma segura con CORE y CIP.
> - **Calidad de Código**: 65 archivos de código, 309 pruebas unitarias/integración (37 suites Jest), cobertura del 100% en rutas críticas.

---

## 1. Quick Links y Documentos Relacionados

- **README del Sistema**: [`cis/README.md`](../../cis/README.md) — Configuración de entorno, puertos y suites de prueba.
- **Contrato de API con el Motor**: [`aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md`](../core/design-artifacts/DOC-006-api-cis-core.md) — Endpoints REST y esquemas de datos.
- **Matriz de Permisos y Guards**: [`aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md`](../ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md) — Guards de autorización por rol y módulo.
- **Conector con Analítica CIP**: [`aidlc-docs/ccp/design-artifacts/DOC-019-dashboard-cip-frontend.md`](../ccp/design-artifacts/DOC-019-dashboard-cip-frontend.md) — Proxy seguro hacia CIP.
- **Conector Móvil QR**: [`aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-002-conector-qr.md`](../app-qr-sicsaft/design-artifacts/DOC-002-conector-qr.md) — Rutas de sincronización móvil.

---

## 1.1 Gaps conocidos de esta carpeta

- **Sin DOC-XXX propio en el catálogo maestro** (`aidlc-docs/README.md`): CIS tiene código real
  desde hace varias fases, pero su diseño de ruteo/circuit-breaker/rate-limit vive solo en
  `cis/README.md` y en este metadata, no en un documento numerado — DOC-002/DOC-006/DOC-023 lo
  tocan pero están catalogados bajo otros sistemas (`app-qr-sicsaft`, `core`, `ccp`).
- **Sin `requirements/`, `story-artifacts/`, `design-artifacts/` ni `testing/` propios** — a
  diferencia de `aidlc-docs/core/` o `aidlc-docs/cip/`, esta carpeta es solo este archivo.
- **Primera escritura del puente CIS→CIP**: `PATCH /dashboard/sesiones/:sesionId/revisar`
  (`cis/src/dashboard-connector/`, protegido con `DirectivoGuard`) — documentado en
  [`../cip/design-artifacts/DOC-036-marcar-sesion-revisada-cip.md`](../cip/design-artifacts/DOC-036-marcar-sesion-revisada-cip.md).

## 2. Arquitectura de Ruteo y Aislamiento

```
[ APP Móvil QR ]   [ Portal Web CCP ]   [ Portal Directivo ]   [ ETL Python ]
       │                   │                     │                  │
       └───────────────────┴──────────┬──────────┴──────────────────┘
                                      │ (HTTP / JWT Keycloak 26)
                                      ▼
                        ┌───────────────────────────┐
                        │    CIS (Puerto 3000)      │
                        │ - Valida JWT Keycloak     │
                        │ - Valida esquemas Zod     │
                        │ - Circuit Breaker         │
                        └─────────────┬─────────────┘
                                      │ (Token de Servicio Interno)
                        ┌─────────────┴─────────────┐
                        ▼                           ▼
            ┌───────────────────────┐   ┌───────────────────────┐
            │   CORE (Puerto 3001)  │   │   CIP (Puerto 3002)   │
            │   Motor BPI / Reglas  │   │   Analítica / BI      │
            └───────────────────────┘   └───────────────────────┘
```

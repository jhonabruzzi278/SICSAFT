# Test Strategy — Portal WEB SICSAFT (Fase 5)

Mismo patrón que `app-qr-sicsaft/aidlc-docs/testing/TEST_STRATEGY.md` — Playwright para flujos
críticos, sin bajar el criterio de cobertura que adopte el resto del ecosistema en ese momento.

## E2E (Playwright, criterio "Done" de `ROADMAP.md` Fase 5)

- **Login + alta de activo**: login OIDC completo (authorization code + PKCE contra un Zitadel
  real, mismo patrón que `devops/local/README.md` § "Cliente OIDC real") → dar de alta un activo
  → verificar que aparece en `GET /catalogo` (mismo endpoint que consulta APP QR) — es literal el
  criterio "Done" de Fase 5, se prueba de punta a punta, no con mocks.
- **Hub por contrato**: dos usuarios de organizaciones con `modulosContratados` distintos ven
  hubs distintos.
- **ABM de Contratos**: suspender un contrato y verificar que el siguiente login de esa
  organización ya no muestra los módulos que dependían de él.

## Unit / component tests

- Formularios (Áreas, Responsables, Contratos): validación de schema Zod, mismo patrón que
  `ProductFormDialog.spec` de APP QR si existe, o el equivalente cuando se implemente.
- Lógica de "qué módulos mostrar en el hub" a partir de `modulosContratados` — función pura,
  testeable sin montar componentes.

## Qué NO se testea en esta fase

- Los módulos sin endpoint real todavía (Áreas/Ubicaciones/Responsables/Auditoría/Contratos, ver
  DOC-013 §3) no tienen e2e contra backend real hasta que Fase 4 les dé un endpoint — se testean
  con mocks mientras tanto, explícitamente marcados como temporales.

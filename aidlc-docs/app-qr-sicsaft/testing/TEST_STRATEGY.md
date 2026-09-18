# Test Strategy

> Reescrito 2026-09-17 — la versión anterior describía specs (`scan.spec.js`,
> `features.spec.js`, `inventory.spec.js`) de un prototipo de inventario de productos retail
> (con IVA, variantes, stock) que ya no existe. Ver nota histórica en `../00_PROJECT_METADATA.md`.

## Framework

Playwright, corriendo contra el build de producción real (`bun run build && bun run preview`, ver
`playwright.config.js`) — no contra el dev server, para detectar problemas específicos de build
(chunking, rutas, CSP) que no aparecen en modo desarrollo. El backend (CIS/CORE) se mockea con MSW
(`src/mocks/`, `VITE_MOCK_API=true`) para que la suite corra rápido y aislada en CI — **no es
evidencia de integración real**, esa evidencia vive en `casos-de-uso/e2e/` y `sicsaft-core/e2e/`
(ver `aidlc-docs/sicsaft-core/testing/TEST_STRATEGY.md` §1).

## Cobertura actual

11 specs e2e en `tests/` (ver el detalle por archivo en
[`TEST_COVERAGE_REPORT.md`](TEST_COVERAGE_REPORT.md)), cubriendo las 12 pantallas del flujo
oficial (DOC-001): setup de sesión, escaneo y sus 8 categorías de clasificación, inventario,
incidencias, auditoría, cola offline/sync, y las brechas de DOC-017 (Fase 3.1).

Los tests usan atributos `data-testid` (no IDs/clases CSS) para no ser frágiles ante cambios de
estilo del lado de Tailwind/shadcn — ver `tests/helpers.js` para los helpers compartidos de setup
de sesión (operador/organización/área/ubicación).

## CI (`.github/workflows/app-qr-ci.yml`)

`bun install` → `bun run build` (type-check + build) → `playwright install --with-deps chromium`
→ `bun run test:e2e` → `docker build` (con placeholders `VITE_*`, nunca hosts reales). Sin `lint`
ni Vitest en el pipeline — ver "Gaps" en `TEST_COVERAGE_REPORT.md`.

## Notas de estabilidad
- El lector QR no tiene cámara real en CI/sandbox — los tests ejercitan el flujo de escaneo vía el
  input de entrada manual, que comparte toda la lógica de resolución con la cámara
  (`scan-resolve.ts`).

## Gaps identificados
Ver [`TEST_COVERAGE_REPORT.md`](TEST_COVERAGE_REPORT.md) — sin Vitest conectado, sin prueba en
dispositivo Android físico, sin Lighthouse/CWV automatizado.

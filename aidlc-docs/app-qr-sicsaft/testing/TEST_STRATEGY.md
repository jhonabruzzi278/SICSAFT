# Test Strategy

## Framework
Playwright, corriendo contra el build de producción real (`npm run build && npm run preview`, ver `playwright.config.js`) — no contra el dev server, para detectar problemas específicos de build (chunking, rutas, CSP) que no aparecen en modo desarrollo.

## Cobertura Actual
18 specs E2E en `tests/`, organizados por área:
- `tests/scan.spec.js` — casos de aceptación del escáner (15/16/20 productos escaneados, split registrados/no registrados, no duplica reconteo).
- `tests/features.spec.js` — entrada manual, resolución de códigos de variante (`BASE-VARIANTE`), toggle de tema, historial de sesiones, export CSV.
- `tests/inventory.spec.js` — alta de producto (con/sin IVA, con/sin variantes), validación de código duplicado, insignia de stock bajo, búsqueda, baja de producto.

Los tests usan atributos `data-testid` (no IDs/clases CSS) para no ser frágiles ante cambios de estilo del lado de Tailwind/shadcn — ver `tests/helpers.js` (`resetApp`, `scanCode`) para los helpers compartidos.

## Notas de estabilidad
- `workers: 4` y `timeout: 60_000` en `playwright.config.js`: con el default (workers = núcleos disponibles) la suite es flaky por contención de recursos en máquinas cargadas (varios Chromium reales en paralelo contra IndexedDB), no por fallos funcionales — se verificó corriendo los tests fallidos en aislamiento (`--workers=1`), donde siempre pasan.
- El lector QR no tiene cámara real en CI/sandbox — los tests ejercitan el flujo de escaneo vía el input de entrada manual (`manual-code-input`), que comparte toda la lógica de resolución con la cámara (`resolveScannedProduct`).

## Gaps Identificados
- Sin tests unitarios aislados para `src/lib/*.ts` (corren indirectamente vía los E2E, pero no hay Vitest configurado para testearlos en aislamiento).
- Sin prueba en dispositivo Android físico (cámara real, instalación PWA real, offline real tras "Agregar a inicio").
- Sin test de Lighthouse/CWV automatizado.

## Recomendación (roadmap)
1. Agregar Vitest para cubrir `src/lib/db.ts`, `labels.ts` y `scan-resolve.ts` en aislamiento (más rápido que E2E completo para la lógica pura).
2. Prueba manual en un dispositivo Android real antes de considerar el flujo de instalación PWA cerrado.

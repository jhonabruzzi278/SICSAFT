# Test Coverage Report

> Reescrito 2026-09-17 — la versión anterior describía la verificación manual de un prototipo
> vanilla-JS de 2026-07-30 que ya no existe (ver nota histórica en `../00_PROJECT_METADATA.md`).

## Cobertura actual: e2e Playwright, sin medición de coverage automatizada

No hay una herramienta de coverage configurada (no hay Vitest activo — ver "Gaps" abajo), así que
no existe un número de cobertura de líneas/funciones. La evidencia de que el flujo funciona viene
de la suite e2e real, que corre en CI (`.github/workflows/app-qr-ci.yml`) contra el build de
producción con mocks MSW (`src/mocks/`):

| Spec (`tests/`) | Qué cubre |
|---|---|
| `session-setup.spec.js` | Selección de operador/organización/área/ubicación al iniciar sesión |
| `scan.spec.js` | Escaneo y clasificación de resultados |
| `scan-classification.spec.js` | Las 8 categorías de clasificación del escaneo (DOC-001 sección 3) |
| `inventory.spec.js` / `inventory-summary.spec.js` | Alta/resumen de inventario, activos esperados/encontrados/faltantes/externos |
| `audit-log.spec.js` | Registro de auditoría/trazabilidad del lado cliente |
| `sync-queue.spec.js` | Cola offline y reintento de sincronización (TASK-008) |
| `features.spec.js` | Funcionalidades transversales (tema, historial, export) |
| `fase-3.1.spec.js` | Brechas de flujo de DOC-017 (veredicto de sesión, estado operativo/baja sugerida, AFT fuera de área) |
| `layout.spec.js` / `redesign-screenshots.spec.js` | Layout responsivo y regresión visual |

Correr localmente: `cd app-qr-sicsaft && bun run test:e2e` (requiere `bun run build` +
`playwright install --with-deps chromium` primero, igual que hace el CI).

## Gaps conocidos

- **Sin Vitest configurado**: existen `src/lib/verdict.test.ts` y `src/lib/oidc/pkce.test.ts` que
  importan de `vitest`, pero el paquete no está en `package.json` ni hay script `test` — quedaron
  como un intento parcial que nunca se conectó a un runner. No corren ni local ni en CI.
- **El e2e valida contra mocks (MSW), no contra CIS/CORE real** — es evidencia de comportamiento
  del frontend, no de integración. La integración real de punta a punta se verifica en
  `casos-de-uso/e2e/` (stack docker compose real) y en `sicsaft-core/e2e/` (el `.exe` empaquetado).
- **Sin prueba en dispositivo Android físico** (cámara real, instalación PWA, offline real).
- **Sin Lighthouse/CWV automatizado.**

## Recomendación (roadmap)
1. Instalar y configurar Vitest para que `verdict.test.ts` y `pkce.test.ts` corran de verdad, y
   sumar cobertura aislada de `src/lib/*.ts` (más rápido que e2e completo para lógica pura).
2. Prueba manual en un dispositivo Android real antes de dar por cerrado el flujo de instalación PWA.

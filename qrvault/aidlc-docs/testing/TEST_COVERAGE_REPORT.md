# Test Coverage Report

No se pudo medir coverage automatizado — no existe suite de tests ni herramienta de coverage configurada en el proyecto (no hay `package.json`).

## Verificación funcional manual (sesión 2026-07-30)

| Caso (spec del brief) | Esperado | Obtenido | Resultado |
|---|---|---|---|
| Prueba 1: 15 productos registrados | 15/15/0 | 15/15/0 | ✅ PASA |
| Prueba 2: 16 (15 + 1 no registrado) | 16/15/1, P016 | 16/15/1, P016 | ✅ PASA |
| Prueba 3: 20 productos | 20/15/5, P016–P020 | 20/15/5, P016–P020 | ✅ PASA |
| Dedupe de re-escaneo del mismo código | No debe duplicar conteo | Confirmado — total no incrementa | ✅ PASA |
| Generación de los 20 QR en `products.html` | 20 tarjetas con QR + nombre | 20 tarjetas renderizadas, P016–P020 marcados "(no registrado)" | ✅ PASA |

**Comando sugerido para medir coverage real en el futuro:** `npx vitest run --coverage` (tras agregar Vitest — ver `testing/TEST_STRATEGY.md`).

# Acceptance Criteria

Tomados directamente del brief del usuario como los 3 casos de prueba oficiales del sistema. **Verificados en esta sesión** ejecutando la lógica real de la aplicación (`handleDecodedCode` + `buildReport`) contra los 20 códigos QR generados en `products.html`.

## Prueba 1 — sólo los 15 productos registrados
- **Esperado:** 15 escaneados / 15 encontrados / 0 fuera de BD / ninguno no registrado.
- **Resultado real obtenido:** `{ total: 15, found: 15, missing: 0 }` ✅ PASA

## Prueba 2 — 16 productos, incluyendo 1 no registrado (P016)
- **Esperado:** 16 escaneados / 15 encontrados / 1 fuera de BD / P016 – Jabón Líquido.
- **Resultado real obtenido:** `{ total: 16, found: 15, missing: 1, missingList: "P016 – Jabón Líquido" }` ✅ PASA

## Prueba 3 — los 20 productos
- **Esperado:** 20 escaneados / 15 encontrados / 5 fuera de BD / P016–P020.
- **Resultado real obtenido:** `{ total: 20, found: 15, missing: 5, missingList: "P016 – Jabón Líquido, P017 – Shampoo Aloe Vera, P018 – Pasta Dental, P019 – Papel Higiénico, P020 – Detergente Líquido" }` ✅ PASA

## Criterio adicional verificado (no explícito en el brief, agregado por robustez)
- Re-escanear un código ya contado en la misma sesión no debe incrementar el total (evita doble conteo por lecturas repetidas de la cámara sobre el mismo QR). Verificado: escanear P001 dos veces mantiene el total en 15, no 16.

⚠️ **Pendiente de validación humana:** estas pruebas se ejecutaron invocando las funciones de la app directamente en consola de navegador (simulando la decodificación), no escaneando QR físicos con una cámara real de un teléfono Android. Se recomienda una prueba manual en dispositivo real antes de considerar el flujo 100% validado end-to-end.

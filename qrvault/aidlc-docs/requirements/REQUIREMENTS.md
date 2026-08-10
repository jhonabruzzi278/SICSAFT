# Requirements

## Functional Requirements (extraídos del brief del usuario)

| ID | Requisito | Estado |
|---|---|---|
| RF-01 | Instalable como PWA en Android (manifest + service worker) | ✅ Implementado (`manifest.json`, `service-worker.js`) |
| RF-02 | Botón "Escanear Código QR" que activa la cámara | ✅ Implementado (`index.html`, `js/app.js`) |
| RF-03 | Lectura de códigos QR vía cámara del dispositivo | ✅ Implementado (`html5-qrcode`, vendorizado en `vendor/`) |
| RF-04 | Comparar código escaneado contra base de datos local | ✅ Implementado (IndexedDB, `js/db.js`) |
| RF-05 | Registrar producto como válido si existe en BD | ✅ Implementado |
| RF-06 | Registrar producto como "no encontrado" si no existe | ✅ Implementado |
| RF-07 | Permitir escaneo continuo de múltiples productos | ✅ Implementado (lista en vivo, dedupe por código) |
| RF-08 | Generar reporte final: total escaneados, encontrados, fuera de BD, lista de no encontrados con nombre | ✅ Implementado (`buildReport()` en `js/app.js`) |
| RF-09 | 20 productos ficticios con código, nombre y descripción | ✅ Implementado (`js/products-data.js`, `FULL_CATALOG`) |
| RF-10 | Base de datos con sólo 15 de los 20 productos (P001–P015) | ✅ Implementado (`REGISTERED_CODES`, seed en IndexedDB) |
| RF-11 | Página para generar/visualizar los 20 códigos QR (para pruebas) | ✅ Implementado (`products.html`) — no estaba pedido explícitamente como pantalla, pero es necesario para poder probar el escaneo sin productos físicos impresos. |

## Non-Functional Requirements

| ID | Requisito | Estado |
|---|---|---|
| RNF-01 | Funcionamiento sin conexión (offline) | ✅ Service worker cachea shell de la app; ⚠️ Pendiente validación humana en dispositivo Android real |
| RNF-02 | Compatible con Android sin app nativa | ✅ Por diseño (PWA estándar); ⚠️ Pendiente prueba en dispositivo físico |
| RNF-03 | Sin dependencias de servidor backend | ✅ 100% cliente, archivos estáticos |
| RNF-04 | UI clara para operación de escaneo repetitivo | ✅ Feedback visual inmediato (toast) + lista en vivo |

## Pendiente de validación humana
- ⚠️ No hay requisito de autenticación/usuarios — asumido no aplica (single-user demo).
- ⚠️ No se especifica qué pasa si el usuario escanea un QR con formato inválido (no es un código de producto) — implementado como "no encontrado" por defecto, requiere confirmación de que ese es el comportamiento deseado.

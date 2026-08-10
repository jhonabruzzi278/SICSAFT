# ADR-001: Vendorizar dependencias JS en lugar de cargarlas por CDN

## Status
Aceptado — **superseded parcialmente por [ADR-002](./ADR-002-react-shadcn-migration.md)**: la app pasó a tener build step (Vite), así que `html5-qrcode` y `qrcode-generator` ahora son dependencias npm reales en vez de estar vendorizadas a mano en `/vendor/`. Se mantiene este documento porque el razonamiento (por qué evitar CDN, por qué esas librerías puntuales) sigue vigente.

## Context
El brief pide usar `html5-qrcode` para el escaneo. La primera implementación cargó esta librería (y `qrcode` para generar los QR de prueba) vía `<script src="https://unpkg.com/...">`. Al verificar la app en el navegador de prueba, los scripts de CDN no se ejecutaban (globals `Html5Qrcode`/`QRCode` quedaban `undefined`) aunque la red saliente sí funcionaba para navegación directa — indicando una restricción del entorno de verificación frente a `<script src>` cross-origin.

## Decision
Descargar ambas librerías a `/vendor/` y servirlas desde el mismo origen:
- `vendor/html5-qrcode.min.js` (build UMD oficial 2.3.8 desde unpkg — funcionó sin cambios).
- `vendor/qrcode.min.js` — se intentó primero `qrcode@1.5.3` (paquete npm "qrcode" de soldair), pero su build publicado en unpkg/jsDelivr para esa ruta usa `require()` (CommonJS) y no es ejecutable directo en `<script>`. Se reemplazó por `qrcode-generator@1.4.4` (Kazuhiko Arase), que es JS puro sin dependencias y expone la función global `qrcode(...)`.

## Consequences
- La app funciona 100% offline y no depende de disponibilidad de CDN en producción — alineado con el requisito PWA.
- `products.html` usa la API de `qrcode-generator` (`qr.addData()`, `qr.make()`, `qr.createSvgTag()`), distinta a la API de `qrcode` (soldair) que se había planeado inicialmente (`QRCode.toCanvas()`). Si en el futuro se reemplaza esta librería, hay que actualizar el script inline de `products.html`.
- Actualizar estas librerías en el futuro requiere descargarlas manualmente de nuevo (no hay gestor de paquetes/lockfile en este proyecto sin build step).

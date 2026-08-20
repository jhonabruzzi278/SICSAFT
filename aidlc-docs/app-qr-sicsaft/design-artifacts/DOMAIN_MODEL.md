# Domain Model (DDD)

## Bounded Context: Inventario QR (single-context, cliente-only)

### Entidades / Value Objects identificados en el código

**Product** (`js/products-data.js` → `FULL_CATALOG`) — Value Object inmutable:
- `code: string` (ej. "P001") — identificador natural
- `name: string`
- `description: string`

**InventoryRecord** (`js/db.js`, IndexedDB object store `products`) — Entity con identidad = `code`:
- Subconjunto de `Product` (los 15 registrados), persistido en IndexedDB (`keyPath: 'code'`).
- Repository: funciones `initInventoryDb`, `seedInventoryIfEmpty`, `lookupProduct`, `productCodeExists` en `js/db.js` actúan como Repository de acceso a `InventoryRecord`.
- Los productos creados desde el formulario "Nuevo Producto" (`js/product-form.js`, `products.html`) agregan campos opcionales agnósticos a cualquier rubro: `category`, `unitType`, `hasIva`/`ivaPercent`/`priceWithoutTax`/`finalPrice`, `stock`/`minStock` (umbral de alerta de stock bajo) y `variants: [{ code, name, stock }]` para talles/colores/presentaciones con stock propio. No hay migración de esquema — IndexedDB no tipa el valor, y el catálogo demo sigue sin estos campos.
- **Variante como etiqueta imprimible** (`js/labels.js`): cada variante se imprime como una etiqueta QR propia cuyo código escaneable es `"${code}-${variant.code}"`; el escáner (`js/app.js` → `resolveScannedProduct`) separa ese código compuesto para resolverlo contra el producto base y su variante.

**ScannedItem** (`js/app.js` → `Map scannedProducts`) — Entity en memoria de la sesión de escaneo:
- `code, name, found: boolean`
- Vive sólo durante la sesión activa; se limpia con `resetSession()`.

**ScanReport** (derivado, no persistido) — Value Object calculado por `buildReport()`:
- `total, found, missing[]` — proyección de `ScannedItem[]` en el momento de finalizar el escaneo.

### Domain Events
No hay sistema de eventos/pub-sub — la app es un flujo síncrono simple (callback de decodificación → lookup → render). No se requiere para el alcance actual.

### Nota de diseño
No se modeló como DDD "puro" con agregados complejos porque el dominio es deliberadamente simple (una única entidad de negocio: Producto). Se documenta aquí para trazabilidad, no para justificar complejidad no necesaria (ver YAGNI).

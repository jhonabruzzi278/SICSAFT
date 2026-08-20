# ADR-002: Migrar de HTML/CSS/JS vanilla a Vite + React + TypeScript + shadcn/ui

## Status
Aceptado

## Context
La app vanilla (ver ADR-001) ya cubría las dos funcionalidades core — generador de etiquetas QR y lector QR — con un formulario completo de producto (IVA, variantes, stock bajo) construido a mano sobre CSS plano y un `<dialog>` nativo. El usuario evaluó el resultado visual y lo rechazó explícitamente ("no me gusta el diseño"), pidiendo usar "alguna librería de componentes o skill para mejorar las interfaces" en vez de seguir iterando el CSS a mano.

Antes de tocar código se le presentaron dos decisiones porque tenían impacto muy distinto en la arquitectura ya construida (PWA offline-first, sin build step):

1. **Enfoque**: rediseño CSS a medida (sin build step) vs. sumar una librería CSS liviana vendorizada vs. migrar a un framework con una librería de componentes real (Vite/build step, mayor alcance).
2. **Dirección visual**: dark luxury / bento-editorial / glassmorphism / que se elija según el uso.

El usuario eligió explícitamente **migrar a framework + librería de componentes** y la dirección **Bento / editorial**.

## Decision
Reescribir la app completa como SPA con:

- **Vite + React 19 + TypeScript** — la app es 100% client-side (cámara, IndexedDB, impresión), sin necesidad de SSR/data fetching de servidor; Next.js no aporta nada acá y complica el service worker. Vite + `vite-plugin-pwa` es el camino más directo para seguir siendo una PWA offline-first.
- **Tailwind CSS v4 + shadcn/ui**, preset **Sera** (`radix-sera`, base `radix`) — el único preset de shadcn descrito como "editorial y typographic", que calzaba directo con la dirección elegida por el usuario sin tener que inventar un sistema de diseño desde cero. Trae tipografía self-hosted (Playfair Display + Noto Sans vía `@fontsource-variable`, sin CDN) y una estética ya distintiva (esquinas rectas, tracking amplio en mayúsculas) que cumple la política interna "anti-template" (nada de look genérico Bootstrap-like).
- **react-router** (no `react-router-dom`, ver más abajo) para rutas reales (`/`, `/history`, `/catalog`) en vez de pantallas show/hide con query params — el shell pasa a ser un dashboard con sidebar persistente (colapsable a Sheet en mobile vía el componente `sidebar` de shadcn), acorde a la dirección bento.
- **react-hook-form + zod** para el formulario de producto — reemplaza la validación y el manejo manual de filas de variantes por `useFieldArray`, siguiendo las reglas de code style del usuario (Zod para validación de esquema).
- **`html5-qrcode` y `qrcode-generator` se mantienen** (mismas librerías que ya estaban vendorizadas en ADR-001, ahora como dependencias npm reales) — la lógica de escaneo y generación de QR ya estaba probada y funcionando; no había motivo para cambiarla, sólo para envolverla en componentes React.
- **`next-themes`** para dark/light (ya era una dependencia transitiva de la Toaster de shadcn) en vez de un hook a medida — evita reinventar algo que ya hay que traer igual.

Toda la lógica de negocio (`db.ts`, `catalog-data.ts`, `labels.ts`, `scan-resolve.ts`) se portó tal cual a TypeScript, sin reescribirla — mismas funciones, mismo comportamiento, sólo tipado.

### Nota: `react-router` en vez de `react-router-dom`
Al auditar vulnerabilidades (`npm audit`) apareció GHSA-qwww-vcr4-c8h2 (CSRF en modo RSC) en el rango `react-router` 7.12.0–7.18.1 y 8.0.0–8.2.0. La versión resuelta ya era `7.18.2` (primer release parcheado de la línea 7.x), así que en la práctica **no había vulnerabilidad activa** — se confirmó con `npm audit` (0 vulnerabilidades). Se documenta igual porque el fix para la línea 8.x (`8.3.0`) sólo se publicó bajo el paquete `react-router` — `react-router-dom` quedó congelado en `8.2.0` sin nuevo release. Cualquier futura actualización a la línea 8 debe hacerse sobre `react-router` (que ya re-exporta todo lo que antes daba `react-router-dom`, incluido `BrowserRouter`), no sobre `react-router-dom`.

## Consequences
- La app deja de ser "sin build step": ahora requiere `npm install` + `npm run build`/`npm run dev`. `playwright.config.js` pasa a levantar `npm run build && npm run preview` en vez de servir estático directo.
- Se eliminan `vendor/`, `js/*.js`, `css/styles.css`, `products.html`, `index.html` (raíz vanilla), `service-worker.js` y `manifest.json` (raíz) — reemplazados por `src/`, `public/`, y la config de `vite-plugin-pwa` en `vite.config.ts`.
- Los tests Playwright se reescribieron con `data-testid` en vez de IDs/clases CSS, para no ser frágiles ante cambios de estilo futuros del lado de shadcn/Tailwind.
- `vercel.json` necesita `rewrites` (fallback SPA a `/index.html`) porque ahora hay rutas de cliente (`/catalog`, `/history`) que antes no existían.
- Bug real encontrado durante la migración: `html5-qrcode` lanza una excepción **síncrona** (no una promesa rechazada) al llamar `.stop()` sobre un scanner que nunca llegó a iniciar — algo que pasa siempre que no hay cámara disponible (tests, sandboxes, permisos denegados). Rompía el árbol de React al salir de la pantalla de escaneo. Corregido envolviendo la llamada en `try/catch` además del `.catch()` de la promesa (`src/components/QrScanner.tsx`).

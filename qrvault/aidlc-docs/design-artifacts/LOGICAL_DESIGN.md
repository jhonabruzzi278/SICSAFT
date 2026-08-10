# Logical Design

## Patterns Detectados en el Código

- **Repository pattern** (ligero): `src/lib/db.ts` encapsula todo el acceso a IndexedDB detrás de `initInventoryDb()` / `lookupProduct()` / `putProduct()` / `productCodeExists()` / `saveSession()`; ningún componente toca IndexedDB directamente. Sin cambios de fondo respecto a la versión vanilla — sólo se le agregó tipado y `productCodeExists`.
- **Static catalog + dynamic inventory split**: `FULL_CATALOG` (20, estático, en `catalog-data.ts`) se usa sólo para nombres/generación de QR de referencia; IndexedDB es la "base de datos" real contra la que se valida. Se mantiene igual.
- **Container/Presentational**: `pages/*.tsx` son los "containers" (dueños de estado, efectos, llamadas a `lib/`); `components/ProductCard.tsx`, `components/ScannedList.tsx`, `components/LabelCard.tsx` son presentacionales puros (reciben props, no llaman a IndexedDB).
- **Lógica pura separada de React** (`src/lib/*.ts`): `labels.ts` (armado de unidades de etiqueta), `scan-resolve.ts` (resolución de código escaneado, incluye variantes `BASE-VARIANTE`), `csv-export.ts`, `scan-feedback.ts` — nada de JSX/hooks ahí, son funciones puras o casi-puras testeables sin montar componentes.
- **Formulario controlado por schema**: `ProductFormDialog.tsx` define un `zod` schema (`productFormSchema`) que es la única fuente de verdad de validación; `react-hook-form` + `useFieldArray` manejan el estado, incluida la lista dinámica de variantes.
- **Portal para impresión**: `PrintLabelsProvider.tsx` mantiene un `<div id="label-print-area">` renderizado vía `createPortal` fuera del árbol principal; `@media print` en `index.css` oculta todo excepto ese nodo cuando `body.printing-labels` está activo. Mismo mecanismo que la versión vanilla, pero declarativo en vez de manipulación directa del DOM.
- **Offline-first / cache-first**: antes vía `service-worker.js` escrito a mano; ahora generado por `vite-plugin-pwa` (Workbox) a partir de `vite.config.ts`. Mismo comportamiento (precache del shell, offline funcional), configuración distinta.

## Stack Tecnológico

| Componente | Tecnología | Fuente |
|---|---|---|
| Framework | Vite 8 + React 19 + TypeScript | `package.json`, `vite.config.ts` |
| UI | Tailwind CSS v4 + shadcn/ui (preset `radix-sera`) | `components.json`, `src/components/ui/` |
| Formularios | react-hook-form + zod + @hookform/resolvers | `src/components/ProductFormDialog.tsx` |
| Ruteo | react-router 8.x (no `react-router-dom`) | `src/App.tsx`, `src/components/AppShell.tsx` |
| Tema | next-themes | `src/main.tsx`, `src/components/ThemeToggle.tsx` |
| Escaneo QR | html5-qrcode 2.3.8 | `src/components/QrScanner.tsx` (dependencia npm, antes vendorizada) |
| Generación QR | qrcode-generator | `src/components/LabelCard.tsx`, `src/components/ProductCard.tsx` (dependencia npm, antes vendorizada) |
| Persistencia | IndexedDB (API nativa) | `src/lib/db.ts` |
| PWA | vite-plugin-pwa (Workbox) | `vite.config.ts` |
| Tipografía | `@fontsource-variable/playfair-display`, `@fontsource-variable/noto-sans` | self-hosted, sin CDN |
| Tests E2E | Playwright, contra `vite build && vite preview` | `playwright.config.js`, `tests/*.spec.js` |

## Servicios Externos Detectados
Ninguno en runtime — la app sigue sin llamadas a APIs externas ni bases de datos remotas. Las dependencias externas (html5-qrcode, qrcode-generator, fuentes) se resuelven en build time vía npm y se empaquetan/self-hostean; no hay carga de CDN en producción.

## Decisiones clave
- Por qué se migró de vanilla a este stack: ver [ADR-002](./ADR/ADR-002-react-shadcn-migration.md).
- Por qué se evitó CDN para las dependencias JS originales (contexto histórico, parcialmente superseded): ver [ADR-001](./ADR/ADR-001-vendored-dependencies.md).

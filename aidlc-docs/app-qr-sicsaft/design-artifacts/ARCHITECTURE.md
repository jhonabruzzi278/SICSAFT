# Architecture Overview

> Ver [ADR-002](./ADR/ADR-002-react-shadcn-migration.md) para el porqué de esta arquitectura (reemplaza la vanilla original documentada en [ADR-001](./ADR/ADR-001-vendored-dependencies.md)). Ver [ADR-003](./ADR/ADR-003-rename-app-qr-sicsaft.md) para el cambio de identidad a APP QR SICSAFT y las reglas de qué se renombró (cosmético) vs. qué queda pendiente de migración (identificadores internos).

## Estructura del Proyecto

```
QRVault/
├── index.html               # Entry point de Vite (SPA)
├── vite.config.ts           # Plugins: React, Tailwind v4, vite-plugin-pwa (manifest + service worker)
├── vercel.json               # Headers de seguridad (CSP, HSTS, etc.) + rewrite SPA
├── src/
│   ├── main.tsx              # Bootstrap: ThemeProvider, BrowserRouter, PrintLabelsProvider, Toaster
│   ├── App.tsx                # Rutas (/, /history, /catalog) con lazy loading por página
│   ├── index.css             # Tailwind v4 + tokens de shadcn (colores de marca oficial SICSAFT, ver ../../../BRAND.md) + reglas de impresión
│   ├── components/
│   │   ├── ui/                # Primitivos shadcn/ui (Button, Dialog, Form, Sidebar, etc.)
│   │   ├── AppShell.tsx       # Sidebar persistente (colapsa a Sheet en mobile) + layout dashboard
│   │   ├── QrScanner.tsx      # Envuelve html5-qrcode con el ciclo de vida de cámara en React
│   │   ├── ProductFormDialog.tsx  # Formulario de producto (react-hook-form + zod + useFieldArray)
│   │   ├── LabelCard.tsx / LabelPreviewDialog.tsx / PrintLabelsProvider.tsx  # Etiquetas QR + impresión
│   │   └── ProductCard.tsx / ProductGrid.tsx / ScannedList.tsx / ThemeToggle.tsx / UpdatePrompt.tsx
│   ├── pages/
│   │   ├── ScanPage.tsx       # Home → escaneo (cámara + entrada manual) → reporte
│   │   ├── HistoryPage.tsx    # Sesiones de escaneo guardadas
│   │   └── CatalogPage.tsx    # Grilla de productos, búsqueda, alta, impresión
│   ├── lib/                   # Lógica pura, sin React — reutilizable y testeable
│   │   ├── db.ts              # Repository IndexedDB (init, seed, lookup, productCodeExists, sessions)
│   │   ├── catalog-data.ts    # FULL_CATALOG (20 productos demo) + REGISTERED_CODES (15)
│   │   ├── labels.ts          # buildLabelUnits/formatPrice — códigos BASE-VARIANTE para etiquetas
│   │   ├── scan-resolve.ts    # Resuelve un código escaneado (directo o BASE-VARIANTE) contra IndexedDB
│   │   ├── csv-export.ts, scan-feedback.ts, global-error-handler.ts
│   └── hooks/useInstallPrompt.ts
├── public/                    # Íconos PWA, fuentes self-hosted, .well-known/assetlinks.json
└── tests/                     # Specs Playwright con data-testid, corren contra `vite build && vite preview`
```

## Tech Stack

| Layer | Tech | Justificación |
|---|---|---|
| Framework | Vite + React 19 + TypeScript | SPA 100% client-side (cámara, IndexedDB, impresión) — sin necesidad de SSR; ver ADR-002 |
| UI | Tailwind CSS v4 + shadcn/ui (base Radix, estructura del preset **Sera**) | Pedido explícito del usuario de usar una librería de componentes; Sera es el preset "editorial", acorde a la dirección visual elegida. Los **colores** ya no son los de fábrica de Sera — se reemplazaron por la paleta oficial de marca SICSAFT, ver [`BRAND.md`](../../../BRAND.md) |
| Formularios | react-hook-form + zod | Validación de esquema + `useFieldArray` para variantes dinámicas |
| Ruteo | react-router (no `react-router-dom`, ver ADR-002) | Rutas reales `/`, `/history`, `/catalog` con deep-linking |
| Tema | next-themes | Dark/light con persistencia en `localStorage`, ya era dependencia transitiva del Toaster |
| Escaneo cámara | html5-qrcode | Se mantiene de la versión vanilla (ADR-001), ahora como dependencia npm |
| Generación QR | qrcode-generator | Se mantiene de la versión vanilla (ADR-001), ahora como dependencia npm |
| Persistencia | IndexedDB | Sin cambios — `src/lib/db.ts` es el port directo de `js/db.js` |
| Offline | vite-plugin-pwa (Workbox) | Reemplaza el manifest/service worker manuales; expone `useRegisterSW` para el banner de actualización |
| Tipografía | `@fontsource-variable` (Playfair Display + Noto Sans) | Self-hosted, sin CDN — mantiene el offline-first y es compatible con el CSP existente |

## Decisiones Arquitectónicas Detectadas
- **Monolito cliente-only**: sigue sin backend; toda la lógica de negocio corre en el navegador. Sin cambios respecto a la versión vanilla.
- **SPA con rutas reales en vez de pantallas show/hide**: el shell (`AppShell.tsx`) es ahora un dashboard persistente con sidebar, no un layout que se reconstruye por página — más apropiado para la dirección bento/editorial pedida.
- **Lógica de negocio separada de React** (`src/lib/*.ts`, sin JSX ni hooks): permite portar el comportamiento ya probado de la versión vanilla sin reescribirlo, y lo deja testeable independientemente de los componentes.
- **Con build step**: a diferencia de la versión vanilla (ADR-001), esta arquitectura requiere `npm install`/`npm run build`. Es la contrapartida directa de poder usar shadcn/ui y Tailwind — se decidió que valía la pena por el pedido explícito del usuario (ver ADR-002).

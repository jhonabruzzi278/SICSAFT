# APP QR SICSAFT — Generador de Etiquetas QR y Lector de Inventario (PWA)

Aplicación Web Progresiva (PWA) instalable en Android/desktop con dos funcionalidades core:

1. **Generador de etiquetas**: alta de productos (nombre, código único, descripción, categoría, tipo de unidad, IVA con cálculo de precio, stock con alerta de stock bajo, variantes/talles con stock propio) y generación/impresión de etiquetas QR — una por producto, o una por variante.
2. **Lector QR**: escanea con la cámara y valida cada código contra el inventario local (IndexedDB), incluyendo códigos de variante (`BASE-VARIANTE`).

## Stack
- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (preset **Sera**, editorial) sobre primitivos Radix
- [react-hook-form](https://react-hook-form.com/) + [zod](https://zod.dev/) para el formulario de producto
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) para el escaneo de cámara
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) para generar los QR de etiquetas y catálogo
- IndexedDB como base de datos local de inventario
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox) para manifest + service worker offline-first
- Tipografía self-hosted (`@fontsource-variable`) — sin CDNs externos, 100% offline

## Cómo correrlo localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Para instalar como PWA o usar la cámara desde un celular, debe servirse por HTTPS (o accederse vía `localhost` en desarrollo).

Build de producción + preview:

```bash
npm run build
npm run preview
```

## Uso
1. **Catálogo** (`/catalog`): crear productos con el formulario completo, imprimir su etiqueta QR (una por variante si aplica), buscar y dar de baja productos.
2. **Escanear** (`/`): apuntar la cámara a un QR generado en el catálogo — se marca como encontrado o no registrado, con feedback sonoro/háptico.
3. **Historial** (`/history`): sesiones de escaneo guardadas, con detalle de productos fuera de base de datos.

## Estructura del proyecto
```
src/
  main.tsx, App.tsx        Bootstrap, router, providers globales
  components/               UI compartida (AppShell, QrScanner, ProductForm, etiquetas)
  components/ui/            Primitivos shadcn/ui
  pages/                     ScanPage, HistoryPage, CatalogPage
  lib/                       db.ts, catalog-data.ts, labels.ts, scan-resolve.ts (lógica pura)
  hooks/                     useInstallPrompt
public/                     Íconos, fuentes, .well-known/assetlinks.json
tests/                      Specs Playwright (data-testid)
```

## 📋 Documentación del Proyecto (AI-DLC)

Este proyecto sigue la metodología AI-DLC. Estado actual: **Early Construction**

Documentación completa en [`/aidlc-docs/`](./aidlc-docs/):
- [Requirements](./aidlc-docs/requirements/)
- [Architecture](./aidlc-docs/design-artifacts/ARCHITECTURE.md)
- [Testing Strategy](./aidlc-docs/testing/TEST_STRATEGY.md)
- [Deployment (pendiente)](./aidlc-docs/deployment/)

Última auditoría: 2026-08-06

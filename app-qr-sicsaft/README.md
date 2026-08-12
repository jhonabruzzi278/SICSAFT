# APP QR SICSAFT — Captura de inventario patrimonial (PWA)

Aplicación Web Progresiva (PWA) instalable en Android/desktop, app de **captura** del ecosistema
patrimonial SICSAFT: identifica al operador, organización/área/ubicación, escanea activos QR,
clasifica cada escaneo contra el catálogo esperado, registra incidencias y encola el envío a
SICSAFT CORE (sin conexión inclusive). No escribe directo a la Base Patrimonial Central — todo pasa
por un Conector QR (hoy un stub local, ver `HANDOFF-APP-QR-SICSAFT.md` sección 5). Conserva además
el generador de etiquetas QR / catálogo de productos como herramienta aparte, fuera del flujo
oficial.

1. **Inventario** (`/`): operador → organización → área/ubicación → escaneo clasificado en 6
   categorías (correcto, otra área, otra ubicación, no registrado, código inválido, ya escaneado) →
   incidencias → cierre, con cola de sincronización offline y registro de auditoría.
2. **Catálogo** (`/catalog`, fuera del flujo oficial): alta de productos y generación/impresión de
   etiquetas QR, incluyendo variantes/talles (`BASE-VARIANTE`).

## Stack
- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (preset **Sera**, editorial) sobre primitivos Radix
- [react-hook-form](https://react-hook-form.com/) + [zod](https://zod.dev/) para el formulario de producto
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) para el escaneo de cámara
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) para generar los QR de etiquetas y catálogo
- IndexedDB como base de datos local (inventario, sesiones, cola de sincronización, auditoría) —
  sin backend real todavía, ver el Conector QR en `HANDOFF-APP-QR-SICSAFT.md`
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
1. **Escanear** (`/`): identificarse como operador (una sola vez, persiste), elegir organización →
   área → ubicación, escanear con cámara o código manual — cada lectura se clasifica contra el
   catálogo esperado y muestra su acción disponible (marcar fuera de lugar, registrar hallazgo
   externo, agregar incidencia). Al finalizar, el inventario se guarda local y se intenta enviar;
   sin conexión queda en cola con reintentos automáticos.
2. **Historial** (`/history`): inventarios guardados con operador/organización/área/ubicación,
   estado de sincronización (con intentos si está pendiente) y un detalle "Ver auditoría" por
   sesión (eventos con su `correlationId`).
3. **Catálogo** (`/catalog`, fuera del flujo oficial): crear productos con el formulario completo,
   imprimir su etiqueta QR (una por variante si aplica), buscar y dar de baja productos.

## Estructura del proyecto
```
src/
  main.tsx, App.tsx        Bootstrap, router, providers globales (incluye useSyncQueue)
  components/               UI compartida: AppShell, QrScanner, ScannedList, OperatorGate,
                             OrganizationPicker, AreaLocationPicker, IncidentDialog,
                             ProductForm/etiquetas (catálogo, fuera del flujo oficial)
  components/ui/            Primitivos shadcn/ui
  pages/                     ScanPage (flujo de inventario), HistoryPage, CatalogPage
  lib/                       db.ts (IndexedDB), qr-connector.ts (Conector QR, stub del
                             contrato DOC-002), sync-queue.ts (cola offline con backoff),
                             audit-log.ts + device-id.ts (auditoría/trazabilidad),
                             scan-resolve.ts (clasificación, función pura), operator.ts,
                             organizations-data.ts, catalog-data.ts, labels.ts
  hooks/                     useInstallPrompt, useSyncQueue
public/                     Íconos, fuentes, .well-known/assetlinks.json
tests/                      Specs Playwright (data-testid) — helpers.js centraliza el setup
                             de sesión (operador/organización/área/ubicación)
```

Contexto de negocio, decisiones ya tomadas y backlog: [`HANDOFF-APP-QR-SICSAFT.md`](./HANDOFF-APP-QR-SICSAFT.md).

## 📋 Documentación del Proyecto (AI-DLC)

Este proyecto sigue la metodología AI-DLC. Estado actual: **Early Construction**

Documentación completa en [`/aidlc-docs/`](./aidlc-docs/):
- [Requirements](./aidlc-docs/requirements/)
- [Architecture](./aidlc-docs/design-artifacts/ARCHITECTURE.md)
- [Testing Strategy](./aidlc-docs/testing/TEST_STRATEGY.md)
- [Deployment (pendiente)](./aidlc-docs/deployment/)

Última auditoría: 2026-08-06

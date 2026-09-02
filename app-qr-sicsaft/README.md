# APP QR SICSAFT — Captura de inventario patrimonial (PWA)

Aplicación Web Progresiva (PWA) instalable en Android/desktop, app de **captura** del ecosistema
patrimonial SICSAFT: identifica al operador, organización/área/ubicación, escanea activos QR,
clasifica cada escaneo contra el catálogo esperado, registra incidencias y encola el envío a
SICSAFT CORE (sin conexión inclusive). No escribe directo a la Base Patrimonial Central — todo pasa
por el Conector QR, que ya habla HTTP real contra CIS→CORE (TASK-007, verificado de punta a punta
el 2026-08-13, ver `HANDOFF-APP-QR-SICSAFT.md` sección 7), con autenticación real de operador vía
Keycloak (OIDC + PKCE, [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md), ver
`src/lib/oidc/`). Conserva además el generador de etiquetas QR / catálogo
de productos como herramienta aparte, fuera del flujo oficial.

1. **Inventario** (`/`): selector de modo 1/2/3 (informativo, Modo 3/RFID deshabilitado hasta
   Fase 8) → operador → organización → área/ubicación → escaneo clasificado en 6 categorías
   (correcto, otra área, otra ubicación, no registrado, código inválido, ya escaneado), con
   declaración opcional de estado operativo por activo (en servicio/mantenimiento/inactivo, sin
   rol especial — Tomo III 1.4) y "sugerir baja" (informativo, la ejecuta el Administrador
   Patrimonial desde WEB) → incidencias → cierre con el **informe de control de área**
   ("Pantalla 8", DOC-029 RF-I / `../casos-de-uso/CONTRATO-PANTALLA-8.md`): escaneados, % del
   área, desglose por estado declarado (EN SERVICIO / EN MANTENIMIENTO / INACTIVO / BAJA), lista
   de AFT escaneados (ORDINARIO — la APP QR sólo lee etiqueta; EXTRAORDINARIO QR+RFID es Nivel 3 y
   lo marca CORE en el CCP), AFT fuera de área agrupados por su área real, faltantes, y la
   declaración del proceso (exitoso/aceptable/defectuoso) con fondo de color → cola de
   sincronización offline y registro de auditoría (Fase 3.1, ver
   `../aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-017-fase-3.1-brechas-flujo.md`).
2. **Catálogo** (`/catalog`, fuera del flujo oficial): alta de productos y generación/impresión de
   etiquetas QR, incluyendo variantes/talles (`BASE-VARIANTE`).

## Tecnología móvil y distribución

**Tecnología**: PWA (Progressive Web App) — una página web construida con tecnologías modernas
(manifest + service worker, `vite-plugin-pwa`/Workbox) que se instala y se comporta como app
nativa. Es multiplataforma por diseño: un solo código web puede instalarse en Android, iOS,
Windows y Mac, sin builds nativos separados por plataforma.

**Estado real validado hoy**: solo Android, empaquetado como TWA (Trusted Web Activity,
`public/.well-known/assetlinks.json` → `app.vercel.qr_vault_nu.twa`) — instalable como APK
directo hoy. **iOS y desktop (Windows/Mac) todavía no están validados en dispositivo físico** —
la PWA en sí no requiere reconstrucción para eso, pero falta la prueba real.

**Plan de distribución**: hoy la app se instala como APK directo. El siguiente paso es publicarla
en Google Play Store (licencia de desarrollador Android ya disponible — el proceso de revisión de
Play Store toma un equipo de revisores y al menos 15 días); después, distribución vía App Store
para iOS. Ninguno de los dos submissions se ha iniciado todavía.

**Pendiente antes de cerrar Nivel 1** (ver `HANDOFF-APP-QR-SICSAFT.md`): prueba física en
dispositivo Android real y en dispositivo iOS real, cubriendo operación offline/online,
cámara y resincronización posterior — bloqueado en acción humana, ningún cambio de código lo
cierra por sí solo.

## Stack
- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) sobre primitivos Radix — colores de marca oficiales de SICSAFT (no el preset "Sera" de fábrica), ver [`BRAND.md`](../BRAND.md)
- [react-hook-form](https://react-hook-form.com/) + [zod](https://zod.dev/) para el formulario de producto
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) para el escaneo de cámara
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) para generar los QR de etiquetas y catálogo
- IndexedDB como base de datos local (inventario, sesiones, cola de sincronización, auditoría) —
  fuente de verdad offline; el envío real contra CIS→CORE lo hace el Conector QR
  (`src/lib/qr-connector.ts`), ver `HANDOFF-APP-QR-SICSAFT.md`
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
   externo, agregar incidencia). Al finalizar se ve el resumen (esperados/faltantes/correctos/fuera
   de lugar/no registrados/externos/incidencias) sin enviar nada todavía; recién al tocar
   "Confirmar y enviar" se guarda y se intenta enviar — sin conexión queda en cola con reintentos
   automáticos.
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
  lib/                       db.ts (IndexedDB), qr-connector.ts (Conector QR real, contrato
                             DOC-002/DOC-006 contra CIS), oidc/ (login real Keycloak OIDC+PKCE),
                             sync-queue.ts (cola offline con backoff),
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

Documentación completa en [`/aidlc-docs/`](../aidlc-docs/app-qr-sicsaft/):
- [Requirements](../aidlc-docs/app-qr-sicsaft/requirements/)
- [Architecture](../aidlc-docs/app-qr-sicsaft/design-artifacts/ARCHITECTURE.md)
- [Testing Strategy](../aidlc-docs/app-qr-sicsaft/testing/TEST_STRATEGY.md)
- [Deployment (pendiente)](../aidlc-docs/app-qr-sicsaft/deployment/)

Última auditoría: 2026-08-06

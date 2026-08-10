# ADR-003: Renombrar QR Vault → APP QR SICSAFT

## Status
Aceptado

## Context
QR Vault nace como un generador de etiquetas QR + lector de inventario standalone (ver ADR-001, ADR-002). El proyecto pasa ahora a integrarse en el ecosistema SICSAFT como la app de **captura** del inventario patrimonial: identificar operador, seleccionar organización/área/ubicación, escanear, validar contra la Base Patrimonial Central (vía CIS/SICSAFT CORE), registrar incidencias y enviar resultados. Ese ecosistema y su backlog quedaron registrados en el tablero Trello [SICSAFT](https://trello.com/b/nCi6W4oB/sicsaft) (tarjetas ADR-001, TASK-001…010, DOC-001/002).

Una auditoría del repo (2026-08-10) confirmó que la app actual **no implementa** la mayor parte de ese flujo todavía: no hay operador/login, no hay organización/área/ubicación, no hay incidencias, no hay envío a un backend (solo export CSV local), y el acceso a datos es directo a IndexedDB sin capa API. El rename es, por lo tanto, el primer paso visible de una migración funcional más grande, no solo un cambio de etiqueta.

## Decision
Renombrar el producto de **"QR Vault"** a **"APP QR SICSAFT"**, aplicado en dos fases:

### Fase 1 — Cosmético (aplicado en este commit)
Cambia únicamente lo que el usuario ve o lee, sin tocar nada que persista datos o identifique el paquete ante terceros:

- Nombre visible en la UI (`AppShell.tsx`, header desktop y mobile)
- Título del navegador y meta `apple-mobile-web-app-title` (`index.html`)
- Manifest PWA generado (`vite.config.ts` — `name`/`short_name`)
- Textos de prompt de instalación y notificación offline-ready (`ScanPage.tsx`, `UpdatePrompt.tsx`)
- `README.md` y `aidlc-docs/00_PROJECT_METADATA.md`
- `package.json` / `package-lock.json` — campo `name` (`qrvault` → `app-qr-sicsaft`)

### Fase 2 — Identificadores internos (pendiente, requiere migración)
**No se toca todavía** porque romper esto sin una migración explícita invalida datos ya guardados en dispositivos con la app instalada, o el enlace de verificación de Android:

- `DB_NAME = 'qrvault-inventory'` en `src/lib/db.ts` — nombre de la base IndexedDB; cambiarlo sin migración huerfaniza los datos locales existentes.
- Claves de `localStorage`: `qrvault-theme` (`src/main.tsx`), `qrvault-print-columns` (`src/components/PrintLabelsProvider.tsx`), `qrvault-catalog-view` (`src/pages/CatalogPage.tsx`).
- Nombre del archivo CSV exportado (`qrvault-reporte-*.csv` en `src/pages/ScanPage.tsx`).
- `package_name: app.vercel.qr_vault_nu.twa` en `public/.well-known/assetlinks.json` — atado al fingerprint de firma del TWA; cambiarlo rompe la verificación de app-link en Play Store si no se rehace todo el empaquetado.
- Referencias equivalentes en `tests/helpers.js`, `tests/features.spec.js`, `tests/inventory.spec.js`.

### Fuera del repo (pendiente, no accionable desde el código)
- Nombre del proyecto en el dashboard de Vercel — se gestiona vía CLI/dashboard de Vercel, no vía archivos del repo.
- No hay `.env`/`.env.example` en el repo — no hay variables de despliegue con el nombre de marca que actualizar.

## Consequences
- Cualquier PR o commit que toque los identificadores de la Fase 2 debe ir acompañado de una migración explícita (ej. copiar `qrvault-inventory` → nuevo nombre de DB preservando `sessions`/`products`, o versionar la clave de `localStorage`) y de la actualización coordinada de `assetlinks.json` + el paquete TWA firmado.
- El backlog de la migración funcional (operador, organización/área/ubicación, incidencias, Conector QR, sincronización con CORE, cola offline) queda fuera de esta ADR y vive en el tablero Trello SICSAFT como TASK-001 a TASK-010 y DOC-001/DOC-002.
- El folder raíz del repo sigue llamándose `QRVault` y el árbol documentado en `ARCHITECTURE.md` no se tocó — renombrar la carpeta es una operación separada, de infraestructura, no de código.

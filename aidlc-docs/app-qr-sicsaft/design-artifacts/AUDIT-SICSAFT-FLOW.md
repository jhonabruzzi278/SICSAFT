# Auditoría: QR Vault / APP QR SICSAFT vs. flujo oficial de captura

Evidencia de [TASK-001](https://trello.com/b/nCi6W4oB/sicsaft) (matriz función → acción) y [TASK-002](https://trello.com/b/nCi6W4oB/sicsaft) (cobertura funcional vs. flujo oficial). Fecha: 2026-08-10. Ver también [ADR-003](./ADR/ADR-003-rename-app-qr-sicsaft.md) para el cambio de identidad.

## TASK-001 — Matriz función actual → acción

| Función actual | Archivo | Estado vs. flujo oficial | Acción |
|---|---|---|---|
| Escáner QR (`html5-qrcode`) | `src/components/QrScanner.tsx` | Cubre "Escanear códigos QR" | Reutilizar |
| Validación contra catálogo | `src/lib/scan-resolve.ts` | Cubre "Validar activos" de forma básica (encontrado / no encontrado, incluye variantes `BASE-VARIANTE`) | Adaptar — normalizar a las 8 categorías de resultado (TASK-005) |
| Sesión de escaneo | `src/pages/ScanPage.tsx`, `src/lib/db.ts` (`saveSession`) | Guarda fecha/total/found/missing; sin operador/organización/área/ubicación | Adaptar — TASK-004 |
| Identificar operador | — | No existe (sin login/auth de ningún tipo) | Crear |
| Seleccionar organización/área/ubicación | — | No existe (catálogo plano, single-tenant) | Crear |
| Registrar incidencias | — | No existe (solo found/missing binario) | Crear |
| Enviar resultados a un backend | `src/lib/csv-export.ts` | Solo exportación CSV local; no hay `fetch`/red en todo `src/` | Crear Conector QR (DOC-002, TASK-006, TASK-007) |
| Acceso a datos | `src/lib/db.ts` | Directo a IndexedDB (`DB_NAME='qrvault-inventory'`), sin capa API/backend | Sustituir por API (TASK-006) |
| Diseño móvil / UI (shadcn + Tailwind) | `src/components/AppShell.tsx` y componentes UI | Funcional, PWA instalable | Reutilizar |
| Catálogo de productos + impresión de etiquetas QR | `src/pages/CatalogPage.tsx`, `src/lib/labels.ts` | No forma parte del flujo oficial de captura pedido | Conservar por ahora (decisión explícita del usuario, 2026-08-10) — fuera del alcance de APP QR SICSAFT hasta nueva decisión |

**Accesos directos a datos vs. capa API**: confirmado que el 100% del acceso a datos es directo (IndexedDB vía `src/lib/db.ts`), no existe ninguna capa API ni backend. Esto bloquea directamente TASK-006/TASK-007/TASK-008 hasta que exista el Conector QR (DOC-002).

## TASK-002 — Cobertura funcional vs. flujo oficial

| Paso del flujo oficial | Estado | Evidencia / gap |
|---|---|---|
| Identificar operador | ❌ Falta | No hay pantalla de login, ni modelo de usuario/operador, ni sesión autenticada en ningún archivo del repo. |
| Seleccionar organización | ❌ Falta | No existe entidad "organización" en `src/lib/db.ts` ni en ningún otro store. |
| Seleccionar área | ❌ Falta | No existe entidad "área". |
| Seleccionar ubicación | ❌ Falta | No existe entidad "ubicación". |
| Iniciar inventario | ⚠️ Parcial | `startScanning()` (`ScanPage.tsx`) arranca una sesión de escaneo con timestamp, pero sin organización/área/ubicación/operador asociados — es una sesión "plana". |
| Escanear códigos QR | ✅ Existe | `QrScanner.tsx` + `handleDecode` en `ScanPage.tsx`, vía `html5-qrcode`. |
| Validar activos | ⚠️ Parcial | `resolveScannedProduct` (`scan-resolve.ts`) resuelve contra el catálogo local (incluye variantes), pero solo devuelve found/not-found — no las 8 categorías pedidas (otra área, otra ubicación, duplicado, ya escaneado, con incidencia, código inválido). |
| Registrar incidencias | ❌ Falta | No hay campo ni pantalla para anotar incidencias, fotos o condición de un activo. |
| Finalizar inventario | ✅ Existe | `finishScanning()` guarda un `ScanSession` (`date`, `total`, `found`, `missing[]`) en IndexedDB vía `saveSession`. |
| Enviar resultados a SICSAFT CORE | ❌ Falta | No hay ninguna llamada de red en el código; solo exportación CSV local (`exportCsv()` en `ScanPage.tsx` + `csv-export.ts`). No existe Conector QR ni contrato con CORE (ver DOC-002). |

**Resumen**: de los 8 pasos del flujo oficial, 2 existen (escanear, finalizar), 2 son parciales (iniciar inventario, validar activos) y 4 faltan por completo (operador, organización, área/ubicación, incidencias, envío a CORE — 5 en realidad, ver tabla). La brecha es arquitectónica, no cosmética: requiere backend/Conector QR (DOC-002), no solo cambios de UI.

## Siguiente paso recomendado
DOC-001 (documentar el flujo oficial con diagrama y pantallas mínimas) y DOC-002 (contrato del Conector QR) son bloqueantes para poder implementar TASK-004 en adelante — sin ellos no hay forma de saber contra qué API/contrato construir sesiones de inventario ni el envío a CORE.

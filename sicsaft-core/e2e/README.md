# Harness E2E del `.exe` — Playwright

Prueba el ejecutable de escritorio (`SICSAFT CORE.exe`, Electron) de punta a punta: arranque de
los servicios embebidos, wizard de primer arranque, portales (CCP / Directivo) servidos por el
propio `.exe`, y los cuatro bugs de robustez que se arreglaron probando con clientes reales
(single-instance, watchdog del login embebido, dead-end del login, cierre sin crash) más el bug
de Keycloak con espacios en la ruta (PR #108).

No reemplaza a los unit tests (`vitest`) ni al harness Docker de `casos-de-uso/e2e/` (que prueba
el stack por contenedores). Esto es la capa de arriba: **el `.exe` tal cual se le entrega al
cliente**.

## Cómo corre

Dos frentes, un solo `.exe` vivo por corrida (`workers: 1`, en serie):

- **Electron** (`_electron.launch`) — arranque, wizard, single-instance, watchdog, relanzamiento,
  cierre. Assert vía IPC (`window.sicsaftCore.*`, `app.evaluate`) y estado del proceso.
- **Portales** (chromium normal → `http://127.0.0.1:8766` CCP / `:8768` Directivo / `:58080`
  Keycloak — HTTP plano, 127.0.0.1 es secure context) — login OIDC por rol, alta de activos y
  estructura, dashboard del Directivo, designación de AFT, gate RBAC (403).
- **BPI** — consultas de sólo lectura a la Postgres embebida (`127.0.0.1:55432`, auth `trust`).

`global-setup` mueve `%APPDATA%\sicsaft-core` a un backup (para no pisar la instalación del
desarrollador) y `global-teardown` lo restaura. Los dos _projects_ (`principal` = specs 01-11,
`ciclo-vida` = 12-13, que corre después en un worker nuevo) comparten esos datos.

## Requisitos

- El `.exe` instalado en `%LOCALAPPDATA%\Programs\SICSAFT CORE\` (ruta con espacio → cubre #108),
  o `release\win-unpacked\SICSAFT CORE.exe` (tras `npm run pack`), o `SICSAFT_CORE_EXE=<ruta>`.
- Chromium de Playwright (`npx playwright install chromium`).
- Puertos libres: 55432, 58080/58081, 56000-56002, 8765/8766/8768.

## Correr

```bash
npm run e2e                 # todo
npx playwright test --config e2e/playwright.config.ts specs/06   # una spec
KEEP_APPDATA=1 npm run e2e  # deja los datos de la corrida (depuración)
npm run e2e:report
```

Primera corrida: cada arranque del `.exe` levanta Postgres + Keycloak + CIS + CORE + CIP
(~3-4 min). La corrida completa ronda 15-25 min (el `ciclo-vida` relanza dos veces más).

## Specs

| # | Cubre |
|---|---|
| 01 | Los 5 servicios embebidos quedan `listo`; portales y Keycloak alcanzables. **#108**: Keycloak arranca desde una ruta con espacio. |
| 02 | Wizard 3 pasos (org Nivel 2 → Director → AFT) → realm + BPI (org/sede/contrato) + usuarios con grupo `{org}::{rol}` y `UPDATE_PASSWORD`. |
| 03 | **#1** — una 2ª invocación termina sola, sin 2ª ventana ni colisión de Postgres. |
| 04 | **#2/#3** — el watchdog del login embebido corta a ~90s de inactividad (no 60s totales) con el mensaje nuevo; "Cambiar de usuario" sigue disponible (no queda pane muerto). |
| 05 | Login OIDC por rol: Directivo → `:8768`, AFT → `:8766`; claims del JWT; credenciales inválidas → sin token; ruta protegida → `/login`. |
| 06 | CCP: alta de tipo de catálogo + alta de activo → CIS→CORE→BPI, visible en `/catalogo` y en la pantalla Activos. |
| 07 | CCP: estructura (área → ubicación → responsable) y un activo asignado a las tres. |
| 08 | Portal Directivo: Dashboard ejecutivo (indicadores CIP, Nivel 2) + endpoints `/dashboard/*` 200. |
| 09 | Portal Directivo: designar un Profesional de AFT (UI real) → clave inicial de un uso, tabla refrescada, rol `administrador-patrimonial`, usuario en Keycloak. |
| 10 | RBAC: CIS responde **403** al AFT en `/directivo/usuarios` (server-side, no de UI); el Directivo sí puede. |
| 11 | Auditoría: `GET /admin/auditoria` y la tabla `auditoria` de la BPI registran las altas patrimoniales y la designación (categoría `identidad`). |
| 12 | Relanzamiento: `instalacion.json` presente → wizard salteado; servicios vuelven a `listo`; `getEstadoIpLan` bien formado (flujo de reconfiguración de IP). |
| 13 | **#4** — `close()` con los 5 servicios arriba: exit 0, sin excepción no capturada, log cierra con `--- sesión finalizada ---` y sin `Object has been destroyed`. |

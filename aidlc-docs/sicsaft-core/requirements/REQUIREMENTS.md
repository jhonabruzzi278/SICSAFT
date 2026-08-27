# Requisitos — SICSAFT CORE (app de escritorio nativa)

Ver `INTENT.md` para el contexto completo. IDs nuevos, prefijo `CORE-` para no colisionar con los
`INST-` de `devops/onprem/` ni los RF/RNF ya numerados de otros sistemas (ver `REQUISITOS.md` raíz)
— importante no confundir con el sistema backend `core/` del monorepo, que ya usa RF/RNF sin
prefijo; este prefijo es solo para requisitos de ESTE incremento (la app de escritorio).

## Funcionales

- **CORE-RF-01**: `sicsaft-core.exe` debe instalar y arrancar, sin Podman/Docker/WSL2, todos los
  servicios de Nivel 1 (Postgres, Keycloak, `cis`, `core`, `cip` — sin Redis, ver ADR-005) como
  procesos hijos del proceso principal de Electron, escuchando en `127.0.0.1` en puertos fijos no
  estándar (evitar colisión con instalaciones previas del cliente).
- **CORE-RF-02**: Debe existir un wizard de primer arranque, corrido por el vendedor
  (administrador del sistema) en la PC del Director, que — en un solo flujo dentro de la app —
  cree el realm/Organization/roles/clients de Keycloak de este cliente (misma lógica que
  `Bootstrap-Keycloak.psm1`, portada a TypeScript) y dé de alta al usuario Director con password
  inicial (temporal, cambio obligatorio en el primer login — mismo mecanismo que
  `KeycloakAdminService.crearUsuarioHuman` ya implementado).
- **CORE-RF-03**: Después del primer login del Director (con cambio de password forzado), la app
  debe permitir designar al Profesional de AFT desde la misma ventana — mismo flujo que
  `GestionarProfesionalAftPage.tsx` (`POST /admin/organizaciones/:orgId/usuarios`), sin reescribir
  esa lógica de negocio.
- **CORE-RF-04**: Los portales `web_admin` (Administrador del Sistema) y `core/frontend`
  (Directivo) deben quedar accesibles dentro de la misma app (vista embebida, no una ventana de
  navegador aparte con URL visible) — servidos desde `127.0.0.1` en vez de `file://`, para no
  repetir el bug de secure context/`crypto.subtle` ya encontrado hoy con dominios `.test`.
- **CORE-RF-05** (CORE-Q-01 resuelta — la APK es un wrap Capacitor de `app-qr-sicsaft/`, ver
  `INTENT.md`): la APK debe poder alcanzar `cis`/Keycloak corriendo en la PC del Director por la
  red local (no solo `127.0.0.1`). Mecanismo exacto (IP fija vs. mDNS/descubrimiento, ver
  CORE-RNF-03) sin definir todavía — pendiente confirmar el `capacitor.config.ts` real de la APK
  (sub-pregunta de CORE-Q-01 en `INTENT.md`) antes de diseñarlo.

## No funcionales

- **CORE-RNF-01**: El instalador final (`.exe`, NSIS vía `electron-builder`) debe dejar claro para
  el usuario/soporte cuánto pesa realmente (Postgres + JRE/Keycloak + Node + Chromium suman varios
  cientos de MB) — no se oculta ni se subestima ese costo en la documentación de este incremento
  (ver `ARCHITECTURE.md` "Costo real, no minimizado").
- **CORE-RNF-02**: El arranque en frío (primera vez que se abre la app tras instalar, o después de
  reiniciar la PC) debe mostrar una pantalla de carga mientras los procesos hijos (sobre todo
  Keycloak, la JVM más lenta de arrancar) quedan listos — nunca una ventana en blanco o sin
  feedback mientras tanto.
- **CORE-RNF-03**: Ningún puerto de los servicios embebidos debe quedar expuesto más allá de lo
  estrictamente necesario — Postgres solo en `127.0.0.1` (nunca en la IP de LAN); solo `cis`
  (y Keycloak, para que la APK pueda loguearse) escuchan en la IP de LAN, cuando CORE-RF-05 quede
  resuelto.
- **CORE-RNF-04**: Los datos de cada instalación (Postgres, config de Keycloak) deben vivir en
  `%APPDATA%/sicsaft-core/` o equivalente — nunca dentro de la carpeta de instalación
  (`Program Files`), que un usuario sin privilegios de administrador no puede escribir.

## Preguntas abiertas

Ver "Preguntas abiertas" en `INTENT.md` (CORE-Q-01/02 resueltas 2026-08-27, CORE-Q-03 sigue
abierta). Redis quedó resuelto el mismo día (ADR-005, ver "Redis — resuelto" en `ARCHITECTURE.md`)
— sacado del ecosistema completo, ya no es una pregunta abierta.

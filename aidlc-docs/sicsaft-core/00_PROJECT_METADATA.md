# SICSAFT CORE — app de escritorio nativa — Metadata del proyecto

**Fase AI-DLC:** Inception

**Sistema:** `sicsaft-core/` (nuevo — app de escritorio Electron, reemplaza a `devops/onprem/`
como camino principal de instalación por cliente, ver `INTENT.md` CORE-Q-02)

**Incremento:** Nivel 1 **y Nivel 2** en un único instalador `.exe` (Postgres/Keycloak/CIS/CORE/CIP
como procesos nativos, sin contenedores — sin Redis, ver ADR-005) + wizard de primer arranque (alta
del Director, alta del Profesional de AFT) + selector de nivel (DOC-030) + consola técnica en
pantalla para diagnóstico de arranque (0.1.1, PR #97).

## Quick links

- Intención: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requisitos: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Implementación: `sicsaft-core/` (carpeta de código, a crear en la raíz del monorepo)

## Estado

🟢 Nivel 1 completo arrancando de verdad (2026-08-27) — Postgres/Keycloak/`cis`/`core`/`cip`
embebidos, verificado real (binarios reales, no solo compilado): typecheck/lint/build/test en
verde. Ver `sicsaft-core/README.md` para el detalle completo.

**Corrección real sobre `CORE-Q-01` (mismo día, después de haberla dado por resuelta)**: no existe
ninguna APK Android ya construida — la afirmación "wrap Capacitor de `app-qr-sicsaft/` ya
compilado fuera del repo" era incorrecta, el usuario la corrigió. `CORE-Q-01` queda **reabierta**
en `requirements/INTENT.md`: construir la APK (o decidir cómo/cuándo) es un incremento aparte, no
resuelto ni bloqueante para este. `CORE-Q-02` (convivencia con `devops/onprem/`) sigue resuelta sin
cambios.

**Redis sacado del ecosistema completo (ADR-005, mismo día)**: el usuario confirmó eliminar Redis
de los 3 perfiles de `devops/`, no solo del embebido — `core/`+`cip/` mueven la cola `cip-eventos`
a `pg-boss` sobre Postgres, `cis/` mueve rate-limiter/device-registry a memoria del propio proceso.
Implementado y verificado real (tests/build/lint en verde en los 3 sistemas + los 3
`docker-compose.yml` + los 2 workflows de CI que tenían Redis). Ver "Redis — resuelto" en
`ARCHITECTURE.md`.

**Binarios vendorizados y los 5 servicios arrancando de punta a punta (mismo día)**: PostgreSQL
16.15-1, Keycloak 26.0.8 + JRE Temurin 17.0.20.1+1 descargados de sus fuentes oficiales y
verificados reales (`initdb`/`postgres.exe`/consulta SQL real; `kc.bat build`+`start --optimized`
con `/health/ready` respondiendo real; `core`/`cip` migrados y respondiendo `/health` real) — ver
`sicsaft-core/resources/README.md` para 3 hallazgos reales encontrados en el camino (el
health-check de Keycloak 26 vive en un puerto de management separado del HTTP principal;
`--db`/`--health-enabled` son opciones de build time, no runtime; Keycloak 26.0.0 tiene un bug real
en el alta de miembros de una Organization, arreglado en 26.0.6 — de ahí vendorizar 26.0.8, no
26.0.0). Más 3 hallazgos reales de wiring encontrados corriendo `npm run dev` por primera vez
(rutas relativas con un `../` de más en los 3 servicios embebidos; `spawn()` de Windows no puede
ejecutar `.bat` sin `shell:true`; `node-pg-migrate` resuelve `dir: 'migrations'` contra el `cwd`
del proceso hijo, no contra dónde vive el script). `service-orchestrator.ts` ya arranca Postgres →
bootstrap de las 4 bases → Keycloak → migra y arranca `core` → migra y arranca `cip`, y `cis`
arranca aparte una vez que el wizard genera sus credenciales. `crearUsuarioDirector` (port
recortado de `KeycloakAdminService.crearUsuarioHuman`/`crearGrant`) implementa el alta real del
Director con el rol `directivo` — verificado real de punta a punta contra un Keycloak vivo,
incluyendo confirmar contra la Admin API que el usuario quedó en el grupo/rol correcto y con
`UPDATE_PASSWORD` forzado.

**Empaquetado real (`electron-builder`) y wizard verificado visualmente por el usuario, mismo
día**: `npm run dist:win` produce un instalador NSIS real con Postgres/Keycloak/`cis`/`core`/`cip`
adentro (`package.json` `"build"` + `scripts/electron-builder-after-pack.cjs` — workaround real:
`extraResources` de electron-builder no copia carpetas llamadas `node_modules` vía su `filter`,
hay que copiarlas a mano en un hook `afterPack`). Recién ahí, mirando la ventana de verdad (no
solo los health-checks de backend, que ya venían en verde), aparecieron **3 bugs reales del
renderer**: `index.ts` apuntaba el `preload` a `.js` pero electron-vite compila `.mjs` con
`"type": "module"`; corregido, Electron con `sandbox: true` tampoco soporta ESM en preload bajo
ninguna extensión; fix real: forzar el build del preload a CJS + `.cjs` en
`electron.vite.config.ts`. El usuario confirmó visualmente que el wizard ya renderiza ("Datos de
esta instalación") después del fix — primera verificación visual real de esta app en toda la
sesión, no solo verificación por `curl`/tests.

**CORE-RF-04 — login único embebido, en verde (2026-08-28)**: `PasoListoConLogin.tsx` +
`portal-login-service.ts` + `static-portal-server.ts` + `instalacion-marker.ts`. Una
`WebContentsView` chica muestra el formulario real de Keycloak, el proceso principal intercepta el
redirect, decodifica `realm_access.roles` y navega esa misma vista a `ccp` (rol
`administrador-patrimonial`) o `core/frontend` (rol `directivo`), servidos por un servidor
estático `node:http` de ~40 líneas dentro del propio Electron. Botón "Cambiar de usuario"
(`prompt=login`). Los relanzamientos saltan el wizard vía `instalacion.json`. `typecheck`/`lint`/
tests en verde en `sicsaft-core`, `cis`, `ccp` y `core/frontend`. **~19 bugs reales** salieron
cableando esto y el lote previo de identidad — consolidados en
[`design-artifacts/DOC-027-bitacora-bugs-reales.md`](design-artifacts/DOC-027-bitacora-bugs-reales.md)
(nombre de rol equivocado `profesional-aft`→`administrador-patrimonial`, SSO silencioso rechazando
`loadURL`, React StrictMode disparando dos flujos OIDC, `WebContentsView` tapando el botón por
compositing, `/health/ready` de Keycloak mintiendo tres veces, password de admin regenerado en
cada arranque, `new URL(path, issuer)` descartando `/realms/sicsaft`, correo duplicado en el
display name, `AppShell` perdiendo la sidebar tras el login client-side, ...).

## Depende de

`cis/`, `core/`, `cip/`, `core/frontend/` (código de aplicación reusado tal cual,
sin cambios) — y de todo el trabajo de identidad de ADR-004 Fases 1-3 (`KeycloakAdminService`,
`KeycloakAuthGuard`, el modelo de roles por Organization) y de ADR-005 (`pg-boss`,
`InMemoryRateLimiter`), que se reusan sin reescribir.

## Bloquea

Nada de forma dura — `devops/onprem/` (Podman) sigue existiendo en paralelo de forma permanente
(CORE-Q-02 resuelta: coexisten, no se reemplaza).

## Próximo paso sugerido

1. ~~Cablear el paso "Profesional de AFT" del wizard~~ **Hecho (2026-08-28)** — `PasoProfesionalAft.tsx`
   es un formulario real (mismo patrón que `PasoDirector.tsx`), handler IPC `altaProfesionalAft`
   → `crearUsuarioProfesionalAft` en `keycloak-bootstrap.ts`. `crearUsuarioDirector`/
   `crearUsuarioProfesionalAft` ahora son wrappers de un `crearUsuarioHumano(admin, orgId, email,
   rol)` genérico. El rol es `administrador-patrimonial` (DOC-027 BUG-29), y `resolverOCrearGrupoRol`
   pasa a (re)asignar el role mapping siempre, no solo al crear el grupo — cierra la versión
   porteada del gap silencioso de `crearGrant()` (DOC-027 "Gaps abiertos" actualizado). El gap del
   `crearGrant()` de `cis/` en sí sigue abierto, es otro deployable.
2. ~~Agregar `ccp`/`core-frontend` a `extraResources` y automatizar `kc.bat build`~~ **Hecho** —
   `scripts/prepack.cjs` (DOC-028 Fase A) buildea el `dist/` de los 6 hermanos y corre `kc.bat
   build` si falta; `npm run dist:win` produce el instalador NSIS real con todo adentro.
3. APK Android (`CORE-Q-01`) — **construida** (DOC-029 RF-H, WebView Kotlin propia en `apk-aft/`,
   `.apk` firmado empaquetado por `prepack.cjs`). Sigue abierto: verificarla en un teléfono real y
   servirla desde el `.exe` con un 2º QR de descarga.
4. CORE-Q-03 — **Nivel 2 resuelto (2026-09-02, [DOC-030](design-artifacts/DOC-030-nivel-2-en-sicsaft-core-exe.md))**:
   selector de nivel en el wizard, el `.exe` sirve el CCP completo en Nivel 2 con el mismo binario;
   `web_admin/` se **eliminó por completo (2026-09)** — instalación autocontenida, sin conexión al
   cliente (descarta DOC-028 Fase F); el CRUD de Organización/Contrato/Sede es intervención directa
   del proveedor. **Nivel 3 (RFID)** sigue sin resolverse (sin código `rfid/`).

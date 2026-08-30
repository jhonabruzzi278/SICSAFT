# SICSAFT CORE — app de escritorio nativa

## Objetivo

Instalador `.exe` único que empaqueta todos los beneficios de Nivel 1 (Postgres, Keycloak, `cis/`,
`core/`, `cip/` — sin Redis, ver ADR-005) como procesos nativos embebidos en una app Electron — sin
Podman, sin Docker, sin WSL2, sin navegador visible para el cliente. Es el camino **prioritario** de
instalación por cliente; `devops/onprem/` (Podman) se mantiene como alternativa para un perfil de
cliente con servidor dedicado — confirmado con el usuario 2026-08-27, ver
[`aidlc-docs/sicsaft-core/requirements/INTENT.md`](../aidlc-docs/sicsaft-core/requirements/INTENT.md)
CORE-Q-02.

Está previsto instalar una APK de Android junto a esta app (un wrap de `app-qr-sicsaft/` con
Capacitor para la APP QR), pero **esa APK no existe todavía** — `CORE-Q-01` quedó reabierta el
2026-08-27 (ver `INTENT.md`): construirla, o decidir cómo/cuándo, es un incremento aparte, no
bloqueante para Nivel 1 embebido.

## Estado

🟢 Los 5 servicios de Nivel 1 (Postgres, Keycloak, `cis`, `core`, `cip`) arrancan de verdad,
verificado real (2026-08-27) — no solo compilado. `npm run typecheck`/`lint:ci`/`build`/`test` en
verde:

- Estructura Electron completa (`electron-vite`: main/preload/renderer) con contextIsolation +
  sandbox — el renderer nunca tiene acceso directo a Node/secretos, todo pasa por IPC tipado
  (`src/shared/ipc-contract.ts`).
- `ManagedProcess` (`src/main/services/managed-process.ts`) — wrapper genérico de spawn/health-
  check/shutdown limpio, reusado por los 5 servicios embebidos (ADR-005 sacó a Redis, un servicio
  menos). Con tests reales.
- **Binarios vendorizados y verificados end-to-end**: PostgreSQL 16.15-1, Keycloak 26.0.8 + JRE
  Temurin 17.0.20.1+1 en `resources/` (ver `resources/README.md` para versiones/fuentes exactas y
  3 hallazgos reales encontrados arrancándolos de verdad: el health-check de Keycloak 26 vive en
  un puerto de management separado; `--db`/`--health-enabled` son opciones de build time, no de
  runtime; Keycloak 26.0.0 tiene un bug real en el alta de miembros de una Organization, arreglado
  en 26.0.6 — de ahí vendorizar 26.0.8).
- `postgres-bootstrap.ts` crea las 4 bases (`keycloak`/`core`/`cip`/`eventos_outbox`) bajo un
  único usuario admin — simplificación deliberada frente al modelo multi-usuario de `devops/`
  (documentada, no un descuido: acá el único cliente de Postgres es esta misma app).
- `service-orchestrator.ts` arranca Postgres → bootstrap de bases → Keycloak → migra y arranca
  `core` → migra y arranca `cip`; `cis` arranca aparte (`iniciarCis()`) una vez que el wizard crea
  sus credenciales de Keycloak.
- `keycloak-bootstrap.ts` — port a TypeScript de `devops/onprem/lib/Bootstrap-Keycloak.psm1`
  (realm, scopes, roles, Organization, clients OIDC) + `crearUsuarioHumano(admin, orgId, email,
  rol)` (port recortado de `KeycloakAdminService.crearUsuarioHuman`/`crearGrant`), con
  `crearUsuarioDirector` (rol `directivo`) y `crearUsuarioProfesionalAft`
  (rol `administrador-patrimonial`) como wrappers. Mismas llamadas a la Admin REST API ya
  verificadas reales en ADR-004 Fase 3.
- Wizard de primer arranque (datos del cliente → alta del Director → alta del Profesional de AFT)
  — **los 3 pasos** llaman IPC real de punta a punta (`bootstrapCliente`/`altaDirector`/
  `altaProfesionalAft`). El paso del Profesional de AFT es opcional (el Directivo también lo
  designa después desde su portal). Los 2 primeros pasos verificados visualmente por el usuario.
- **Empaquetado `electron-builder` real** (`npm run dist:win`) — instalador NSIS con Postgres/
  Keycloak/`cis`/`core`/`cip` **y los portales `ccp`/`core-frontend`** (`dist`+`node_modules`+
  `migrations`+`scripts`+`src` donde aplica) empaquetados adentro, ver `package.json` `"build"` y
  `scripts/electron-builder-after-pack.cjs` (workaround real: el `filter` de `extraResources` de
  electron-builder no copia carpetas literalmente llamadas `node_modules`, hay que copiarlas a
  mano en un hook `afterPack`). `pack`/`dist:win` corren primero `scripts/prepack.cjs` (DOC-028
  Fase A): buildea el `dist/` de los 5 sistemas hermanos y corre `kc.bat build --db=postgres
  --health-enabled=true` si falta — ya no hay pasos manuales antes de empaquetar.

**3 bugs reales del renderer, encontrados recién con DevTools abierto (2026-08-27)** — todos con
la app arrancando "bien" por fuera (los 5 servicios en verde), pero la ventana quedaba en blanco
porque nunca se había mirado la consola del renderer, solo los health-checks del backend:

1. `index.ts` apuntaba el `preload` a `index.js`, pero electron-vite compila a `index.mjs` con
   `"type": "module"` en `package.json` — `ENOENT` real.
2. Corregido a `.mjs`, Electron con `sandbox: true` no soporta ESM en preload bajo ninguna
   extensión — `"Cannot use import statement outside a module"` real, su loader sandboxeado solo
   entiende CommonJS.
3. Fix real: forzar el build del preload a CJS + extensión `.cjs` en `electron.vite.config.ts`
   (`.cjs` siempre es CommonJS para Node/Electron, sin importar `"type": "module"`) — `index.ts`
   apunta a esa extensión. Ver los comentarios en ambos archivos para el detalle completo.

**Login único embebido (CORE-RF-04) — en verde (2026-08-28)**: la pantalla "listo" del wizard
muestra el formulario real de Keycloak en una `WebContentsView` chica; el proceso principal
intercepta el redirect, lee el rol del JWT y navega esa misma vista a `ccp` (Profesional de AFT,
rol `administrador-patrimonial`) o `core/frontend` (Directivo, rol `directivo`), servidos por un
servidor estático `node:http` de ~40 líneas dentro del propio Electron (`static-portal-server.ts`,
sin dependencia nueva). Los relanzamientos saltan el wizard vía `instalacion.json`
(`instalacion-marker.ts`). Botón "Cambiar de usuario" (`prompt=login`). `typecheck`/`lint:ci`/
tests en verde en `sicsaft-core`, `cis`, `ccp` y `core/frontend`.

**Bitácora de bugs reales**: todos los errores encontrados y corregidos en esta línea de trabajo
(migración a Keycloak, vendorizado, wizard, APP QR por LAN, login embebido) están consolidados en
[`aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md`](../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md)
— ~44 bugs con causa raíz, commit y los patrones que se repiten.

**Camino a "cliente final"**: el plan de fases para pasar de "piloto supervisado en la máquina del
desarrollador" a "se le entrega el `.exe` a un cliente" está en
[`aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md`](../aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md).
Estado: **Fases A, B, C y D hechas** — `pack`/`dist:win` sin pasos manuales (A), base patrimonial
limpia + alta de la organización del cliente por el wizard (B), config de portal en runtime +
reconfiguración de ~1 clic ante un cambio de IP (C), y el propio `.exe` sirve la PWA de la APP QR
por HTTPS + muestra un QR en la pantalla "listo" (D). Verificado E2E el 2026-08-29 (39/39). Queda
**Fase E** (APK Android, `CORE-Q-01`) como track aparte — la PWA por QR es el camino oficial
mientras tanto.

**Lo que NO está resuelto todavía** (ver
[`aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md`](../aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md)
y DOC-028 para el detalle real de cada uno, sin minimizar):

- **`npm run dist:win` contra una PC Windows genuinamente limpia** todavía no se corrió de punta a
  punta (sí `npm run pack` → `win-unpacked` + build de Keycloak horneado).
- **Cambio de IP de la PC** (mitigado, DOC-028 Fase C): un relanzamiento detecta que la IP de LAN
  cambió y ofrece una pantalla de reconfiguración de ~1 clic (re-registra el client OIDC de la APP
  QR en Keycloak); los portales embebidos ya no dependen de una IP horneada en el build. Sigue
  faltando el hostname `.local` vía mDNS (DOC-028 C.3) para no depender de la IP en absoluto.
  **Recomendación operativa**: pedir al administrador de red una **reserva DHCP** para la PC del
  Directivo, así la IP no cambia de entrada. El override `SICSAFT_CORE_LAN_IP` sigue disponible
  para forzar una IP puntual (PR #63).
- **Certificado autofirmado de la APP QR**: el navegador del teléfono muestra un aviso de
  seguridad la primera vez (se acepta y queda). Un cert que valide sin aviso requiere el hostname
  `.local` + mDNS de C.3, o una CA propia — fuera de alcance de Fase D.
- **La APK Android no existe todavía** — no hay una APK Capacitor construida (`CORE-Q-01`
  reabierta). El camino oficial es la PWA que sirve el `.exe` (DOC-028 Fase D); la APK es Fase E.

## Depende de

`cis/`, `core/`, `cip/`, `web_admin/`, `core/frontend/` (código de aplicación reusado tal cual) y
de todo el trabajo de identidad de ADR-004 (Fases 1-3) — `KeycloakAdminService`,
`KeycloakAuthGuard`, el modelo de roles por Organization.

## Bloquea

Nada de forma dura — convive con `devops/onprem/` (Podman) de forma permanente (CORE-Q-02
resuelta: no lo reemplaza).

## Documentos relacionados

- [`aidlc-docs/sicsaft-core/`](../aidlc-docs/sicsaft-core) — INTENT/REQUIREMENTS/ARCHITECTURE
  completos.
- [DOC-027](../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md) —
  bitácora consolidada de bugs reales de toda esta línea de trabajo.
- [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — identidad Keycloak, reusada
  tal cual acá.
- [ADR-005](../adr/ADR-005-postgres-pgboss-reemplaza-redis.md) — Redis sacado del ecosistema
  completo, `pg-boss`/memoria en su lugar.

## Desarrollo local

```bash
npm install
npm run dev          # electron-vite dev — abre la ventana + DevTools (solo dev), HMR real
npm run typecheck
npm run lint:ci
npm test
npm run build         # compila main/preload/renderer a out/
npm run prepack:artefactos  # DOC-028 Fase A: buildea el dist/ de ccp/core-frontend/cis/core/cip
                            #  + kc.bat build (solo si falta). Lo corren pack y dist:win solos.
npm run pack           # prepack + electron-builder --dir -- empaquetado sin instalador, rápido de iterar
npm run dist:win       # prepack + instalador NSIS real -- lento (comprime ~1.3GB con LZMA), usar
                        # solo cuando hace falta el .exe final, no para cada cambio chico
```

`npm run dev` necesita los binarios vendorizados en `resources/` (ver `resources/README.md`) —
sin ellos, `service-orchestrator.ts` falla apenas intenta arrancar Postgres/Keycloak con un error
claro. `npm run pack`/`dist:win` además necesitan `node_modules` en `ccp/`, `core/frontend/`,
`cis/`, `core/` y `cip/` (`npm ci` en cada uno) — `scripts/prepack.cjs` falla con un error claro
si falta alguno. `npm run dev`/`npm run pack`/`npm run dist:win` abren DevTools automáticamente en modo no
empaquetado (`!app.isPackaged`) — mirar la consola ahí es el primer paso real para diagnosticar
cualquier pantalla en blanco, no asumir que el problema está en el backend solo porque los
health-checks respondan bien.

## Próximo paso sugerido

Ver "Próximo paso sugerido" en
[`aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md`](../aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md)
— cablear el paso "Profesional de AFT" del wizard al endpoint real de `cis/`, y decidir cuándo/cómo
se construye la APK Android (`CORE-Q-01`, reabierta).

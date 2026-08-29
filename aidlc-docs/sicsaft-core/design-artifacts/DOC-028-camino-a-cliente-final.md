# DOC-028 — Camino a "cliente final" para `sicsaft-core.exe`

> Plan de fases para llevar el instalador `.exe` de sicsaft-core desde "sirve para un piloto
> supervisado en la máquina del desarrollador" hasta "se le entrega a un cliente y lo instala".
> Complementa el track `sicsaft-core` de [ROADMAP.md](../../../ROADMAP.md), la
> [ARCHITECTURE.md](ARCHITECTURE.md) del sistema y la bitácora de bugs
> [DOC-027](DOC-027-bitacora-bugs-reales.md). No reabre ADR-004/ADR-005.

## 1. Estado verificado hoy (no README, código + corrida real 2026-08-29)

Lo que **funciona**, confirmado arrancando el stack de cero esta sesión:

- Los 5 servicios embebidos (Postgres 16.15 / Keycloak 26.0.8 / `cis` / `core` / `cip`) arrancan
  de cero en ~100 s. Los fixes de PR #63 (health-check de Keycloak 60 s → 180 s, backends 30 s →
  90 s, override `SICSAFT_CORE_LAN_IP`) confirmados en vivo: Keycloak tardó 68 s y el orquestador
  no lo dio por muerto.
- Wizard de primer arranque (3 pasos: datos del cliente → alta del Director → alta del Profesional
  de AFT) con alta real en Keycloak vía la Admin REST API.
- Login único embebido: `WebContentsView` chica con el formulario real de Keycloak, el proceso
  principal lee el rol del JWT y navega a `ccp` (Profesional de AFT) o `core/frontend` (Directivo).
- Flujo completo **APP QR (PWA) → CIS → CORE → Base Patrimonial** verificado de punta a punta con
  un teléfono real: login OIDC/PKCE, escaneo clasificado por el Motor de Reglas, `POST
  /inventarios` persistido en `sesiones_inventario` + eventos `escaneo_qr`/`baja_sugerida`,
  idempotencia OK, y CORE rechaza (401) el token de operador si se lo llama directo.

Lo que **falta** para un cliente real (todo lo de este documento):

| # | Gap | Efecto en un `.exe` instalado en la PC de un cliente |
|---|---|---|
| 1 | `ccp`/`core-frontend` no están en `extraResources` de `electron-builder` | `static-portal-server.ts` resuelve el `dist/` hermano **solo en dev** — instalado, después del login no hay portal que servir |
| 2 | `kc.bat build --db=postgres --health-enabled=true` es un paso manual | Sin él, `kc.bat start --optimized` no arranca ("build time options ... differ from what is persisted") |
| 3 | El CORE embebido corre `migrate up` **incluyendo** `seed-dev-fixture*` | La base patrimonial arranca con "DUOC UC" + notebook/proyector de prueba |
| 4 | El wizard crea la Organization en **Keycloak**, no la org/contrato/sede en **CORE** | Sin org+contrato en CORE, el Profesional de AFT no ve el catálogo de su organización ni puede enviar inventarios reales de ella |
| 5 | La IP de LAN se congela al arrancar (`IP_LAN` a nivel de módulo) | Si el router del cliente reasigna la IP, login y tokens quedan apuntando a una dirección muerta, sin recuperación guiada |
| 6 | No hay APK Android — `CORE-Q-01` reabierta | El Profesional de AFT necesita abrir la PWA en el navegador del teléfono contra `https://<ip>:8765` con cert autofirmado, y alguien tiene que correr `npm run preview` de `app-qr-sicsaft/` a mano |
| 7 | No hay forma de mantener el `.exe` a distancia | Auditar el sistema mes a mes, sacar copias, aplicar migraciones o actualizar la versión exige subirse a la PC del cliente por AnyDesk y tocar comandos — no hay portal ni API de control |

## 2. Fases, en orden de dependencia y de bloqueo

### Fase A — Empaquetado real (el `.exe` funciona instalado)

**Alcance**: `sicsaft-core/` solamente. Sin decisiones de diseño abiertas — el código runtime
(`rutaDistDePortal()` ya distingue `app.isPackaged`) está listo; falta la configuración de build.

- **A.1** — `ccp` y `core/frontend` a `extraResources` (`from: "../ccp"` / `"../core/frontend"`,
  `to: "ccp"` / `"core-frontend"`, `filter: ["dist/**/*"]`). Mismo patrón que `cis`/`core`/`cip`.
- **A.2** — Script `scripts/prepack.cjs` (invocado por `pack`/`dist:win` antes de
  `electron-builder`) que:
  1. corre `npm run build` en `ccp/`, `core/frontend/`, `cis/`, `core/`, `cip/` (los `dist/` que
     `extraResources` va a copiar);
  2. corre una vez `kc.bat build --db=postgres --health-enabled=true` dentro de
     `resources/keycloak/bin/` con `JAVA_HOME`/`JRE_HOME` al JRE vendorizado, **solo si** el
     output (`lib/quarkus/quarkus-application.dat`) no existe o quedó viejo.
- **A.3** — README de `sicsaft-core/` y `resources/README.md`: el flujo de empaquetado pasa a ser
  un solo `npm run dist:win`, sin pasos manuales.

**Entrega**: `npm run dist:win` produce un `.exe` que, instalado en una PC limpia, arranca los 5
servicios, corre el wizard y muestra los portales tras el login. **Sin decisiones pendientes —
esta fase se implementa junto con este documento.**

### Fase B — Base patrimonial limpia + alta de la organización del cliente

**Alcance**: `sicsaft-core/` + una decisión de diseño sobre el seed (multi-deployable). **Es la
fase más importante para "cliente real"** — sin ella el `.exe` sirve para una demo, no para
operar.

- **B.1 — Gate del seed de dev.** `core/migrations/1755000000001_seed-dev-fixture.ts` y
  `1755100000001_seed-dev-fixture-patrimonial.ts` no insertan nada si no está
  `SICSAFT_SEED_DEV=1`. node-pg-migrate igual las marca como aplicadas (no rompe el orden). El
  embedded no setea la env var → base limpia; dev/CI/e2e la setean.
  - **Blast radius** (por eso es su propio PR con checklist): `core/Dockerfile` (e2e),
    `.github/workflows/core-ci.yml`, `cis-ci.yml`, `devops/local/docker-compose.yml`,
    `devops/onprem/docker-compose.yml`, `devops/onprem/lib/*`, y los scripts de test de `core/`
    y `cis/` que hoy asumen el fixture DUOC UC.
- **B.2 — El wizard provisiona la organización en CORE.** El paso 1 del wizard, además de
  `bootstrapCliente` (Keycloak), llama a un handler IPC nuevo `provisionarOrganizacionCore` que
  inserta en la base `core`: `organizaciones` (id = `organizacionId` del wizard, nombre =
  `clienteNombre`), `contratos` (vigencia, `modulos_contratados` según el nivel), `sedes` (una
  "sede principal", campo nuevo del paso 1), `contrato_sedes`. INSERT parametrizado directo
  (mismo patrón que `postgres-bootstrap.ts`), **no vía HTTP** — a esa altura del wizard no hay
  usuario autenticado.
  - **Alternativa descartada**: embeber `web_admin` en el `.exe` para que el Administrador del
    Sistema cree la org. Descartada — suma un 4.º portal + un rol + un login más a un instalador
    que hoy tiene 2, para una operación que se hace una sola vez por instalación.
  - **Consistencia de alias**: con ADR-004, el `alias` de la Organization de Keycloak **es** el
    `organizacionId` de CORE (sin traducción, ver `cis/src/keycloak-admin/keycloak-admin.types.ts`).
    El wizard ya usa el mismo `organizacionId` para las dos cosas — no hay mapa que mantener.

**Entrega**: un `.exe` instalado en un cliente nuevo arranca con base patrimonial vacía + la
organización/contrato/sede del cliente. El Profesional de AFT ve su catálogo (vacío al principio,
se llena con las importaciones/altas del rol Administrador Patrimonial) y envía inventarios reales
de su organización.

**Necesita tu OK antes de codear**: (a) el enfoque de B.1 (gate por env var vs. mover los seeds a
un `migrations-dev/` aparte), y (b) que B.2 sea provisión directa a la DB desde el wizard (vs.
otra opción).

### Fase C — Estabilidad de IP en red real

**Alcance**: `sicsaft-core/` + doc. Decisión de UX sobre el enfoque de recuperación.

- **C.1** — El primer arranque persiste la IP de LAN detectada en `instalacion.json`. Cada
  relanzamiento compara la IP actual con la guardada; si cambió, muestra una pantalla clara
  ("la IP de esta PC cambió de `X` a `Y` — [Reconfigurar]") que re-registra los `redirectUris`/
  `webOrigins` de los clients OIDC del realm y reescribe `KC_HOSTNAME`, sin reinstalar.
- **C.2** — El README de `devops/onprem/` y el instalador recomiendan una **reserva DHCP** para
  la PC del Director.
- **C.3** (futuro, no esta fase) — Hostname `.local` vía mDNS + cert propio. Más robusto, más
  pesado; su propio incremento.

**Entrega**: un cambio de IP no deja la instalación inservible; hay un camino guiado de
recuperación de ~1 clic.

**Necesita tu OK antes de codear**: si C.1 (recuperación guiada) alcanza para la primera versión,
o si querés ir directo a C.3 (mDNS).

### Fase D — La PWA de APP QR servida por el propio `.exe`

**Alcance**: `sicsaft-core/`. Sin decisiones abiertas.

- **D.1** — El `.exe` sirve también `app-qr-sicsaft/dist` por **HTTPS** (cert autofirmado, patrón
  ya resuelto para la APP QR) en `:8765`, escuchando en la IP de LAN — el mismo
  `static-portal-server.ts` + TLS. `app-qr-sicsaft/dist` entra a `extraResources` (con Fase A).
- **D.2** — La pantalla "instalación completa" del wizard muestra un **QR con
  `https://<ip>:8765`** para que el Profesional de AFT lo escanee con la cámara del teléfono y
  abra la PWA directo.

**Entrega**: el Profesional de AFT escanea el QR de la pantalla del `.exe` y entra a la PWA — sin
que nadie corra comandos. Sigue faltando la APK (Fase E) para una instalación "de app store", pero
el flujo de LAN queda self-service.

### Fase E — APK Android (`CORE-Q-01`)

Track aparte, su propio ciclo de diseño (Inception → Construction). Capacitor sobre
`app-qr-sicsaft/`. Preguntas abiertas: dónde vive el tooling (¿este monorepo?), keystore, y que un
**TWA no valida contra un cert autofirmado de LAN** — probablemente un WebView plano con la IP/host
configurable en el primer arranque, no un TWA. **No bloquea Fases A-D** — la PWA por navegador
(Fase D) cubre el uso mientras tanto.

### Fase F — Portal de administración remota (mantenimiento · auditoría · actualizaciones)

**Alcance**: `sicsaft-core/` (botón + servir `web_admin` + una API de control local) + `web_admin/`
(tres secciones nuevas) + doc de acceso remoto en `devops/onprem/`. **Depende de Fase A** (patrón
`extraResources` para servir un `dist/` más) y **de Fase C** (IP de LAN persistida). Es el gap "no
puedo dar soporte a un `.exe` instalado en el campo sin subirme a la PC del cliente por AnyDesk y
tocar comandos".

Contexto: DOC-028 Fase B.2 descartó embeber `web_admin` **para el alta de la organización** (una
operación de una sola vez, el wizard la cubre). Fase F lo reincorpora para otro propósito —
mantenimiento recurrente y auditoría a distancia — que sí justifica el 4.º portal. Sigue habiendo
un login por rol (DOC-022): este portal es el del **Administrador del Sistema**
(`administrador-sistema`, el string real de los guards de CIS/CORE), no una sesión compartida.

- **F.1 — El `.exe` sirve `web_admin/dist`** en `:8770` por HTTPS (cert autofirmado, mismo
  `static-portal-server.ts` + TLS que Fase D). `web_admin/` entra a `extraResources` (patrón de
  Fase A). Escucha en `127.0.0.1` **y** en la IP de LAN persistida (Fase C), nunca en `0.0.0.0`; el
  `.exe` no abre puertos en el router.
- **F.2 — Botón "Administración del sistema"** en la pantalla post-wizard de `sicsaft-core` (hoy
  ese lugar solo tiene el login embebido de ccp/core-frontend). Dos caminos con el mismo portal:
  - **Local / AnyDesk**: lo abre en una `WebContentsView` con la sesión ya iniciada — el proceso
    principal tiene las credenciales del realm embebido, mismo mecanismo que el launcher de
    ccp/core-frontend (`portal-login-service.ts`).
  - **Remoto / VPN**: el botón muestra la URL `https://<ip-lan>:8770` + un QR; el técnico entra
    desde su PC estando en una VPN al LAN del cliente y se loguea como Administrador del Sistema.
- **F.3 — API de control local** en el proceso principal de Electron (`127.0.0.1` + IP de LAN,
  **solo** con JWT de rol `administrador-sistema` del realm embebido — el mismo punto de validación
  que ya usa el resto del ecosistema, ADR-002/ADR-004). Es la capa que un SPA no puede hacer sola
  (reiniciar servicios, correr migraciones, tocar disco):
  - `GET  /control/estado` — salud de los 5 servicios, versión instalada, última copia, disco libre.
  - `POST /control/backup` · `GET /control/backups` · `POST /control/restore` — `pg_dump`/`pg_restore`
    de las bases `core`/`cip` a una carpeta configurable.
  - `POST /control/migraciones` — corre las migraciones pendientes de `core`/`cip` (reusa
    `migration-runner.ts`) y devuelve el log.
  - `POST /control/reiniciar` — reinicia `core`/`cip`/`cis` (no Postgres/Keycloak salvo pedido
    explícito).
  - `GET  /control/version` — versión instalada + última versión conocida (dato estático embebido
    en el build por ahora, sin feed remoto — ver decisión 2).
  - `POST /control/actualizar` — **v1: solo aplica migraciones pendientes + reinicia** (orquesta
    `/control/migraciones` + `/control/reiniciar` y devuelve el log unificado). El reemplazo del
    binario del `.exe` queda para un incremento posterior (decisión 2).
- **F.4 — `web_admin`: tres secciones nuevas** detrás del login Administrador del Sistema:
  - **Auditoría** — lee `GET /auditoria` de CIS (ya existe, DOC-023 3), con filtro por rango de
    fechas / mes. En v1 incluye **la vista filtrable en pantalla y el export del informe mensual en
    `.docx`** (estilo de informe ya fijado con el usuario — portada + TOC, navy/teal, tablas con
    header oscuro).
  - **Mantenimiento** — consume `GET /control/estado`; botones de backup / restore / reiniciar
    servicios, con el resultado en vivo.
  - **Actualizaciones** — versión instalada vs. última conocida (`GET /control/version`);
    "actualizar ahora" → `POST /control/actualizar` (v1 = migraciones + reinicio), con el log en
    vivo. Si hay un instalador nuevo, muestra "descargá y corré el instalador" — el swap del
    binario todavía no es automático.
- **F.5 — Cuenta de soporte.** El wizard (o el panel post-wizard) crea un usuario de rol
  `administrador-sistema` en el realm — sin él no hay login remoto. Contraseña mostrada una sola
  vez, igual que Director / Profesional de AFT.
- **F.6 — Doc de acceso remoto** (`devops/onprem/README.md` + `sicsaft-core/README.md`): el portal
  y la API de control escuchan en la IP de LAN pero **nunca** se publican a internet; el canal es
  una VPN al LAN del cliente o AnyDesk a la PC del Directivo. Checklist de endurecimiento para F.3
  (rate limit, el token expira, `restore`/`actualizar` piden confirmación explícita, todo lo de
  `/control/*` queda en el log de auditoría).

**Entrega**: desde el `.exe` instalado en un cliente, un técnico —local por AnyDesk o remoto por
VPN— audita el sistema mes a mes, saca una copia, aplica migraciones y actualiza la versión sin
tocar una consola.

**Decisiones tomadas (2026-08-29)** — la implementación de F sigue necesitando un pase del
`security-reviewer` sobre la API de control (F.3) antes del merge:
1. **Exposición**: portal + API de control atados a `127.0.0.1` **y** a la IP de LAN persistida
   (Fase C), nunca `0.0.0.0`. La VPN al LAN del cliente alcanza para el acceso remoto; el `.exe`
   no abre puertos en el router. La protección real es el login `administrador-sistema` + rate
   limit + token que expira + auditoría de todo `/control/*`.
2. **"Actualizar" en v1 = solo migraciones + reinicio.** El swap del binario del `.exe`
   (`electron-updater` + un feed de versiones a hostear + firma de código + rollback si la versión
   nueva no bootea) es su propio incremento posterior — es lo más riesgoso de apurar en la PC de
   un cliente. `GET /control/version` da el dato "instalada vs. última conocida" ya en v1.
3. **Informe de auditoría = vista filtrable + export `.docx` mensual, las dos en v1.** El "mes a
   mes" es el punto: el `.docx` es el entregable que se le pasa al Directivo / se archiva. Costo
   extra sobre "solo la vista" es chico (los datos ya salen por `GET /auditoria`, el estilo `.docx`
   ya está fijado).

## 3. Orden de ejecución

```
Fase A (empaquetado)         ── se implementa con este doc, sin decisiones abiertas
  ├─ Fase D (PWA en el .exe) ── depende de A (extraResources); sin decisiones abiertas
  └─ Fase F (portal admin)   ── depende de A (extraResources) y C (IP persistida); decisiones 1-3 tomadas, falta security review
Fase B (base limpia + org)   ── la más importante; necesita OK sobre B.1 y B.2
Fase C (estabilidad de IP)   ── necesita OK sobre el enfoque (C.1 vs C.3)
Fase E (APK)                  ── track aparte, no bloquea nada de A-D
```

`main` puede recibir A y D como PRs de una sola capa (`sicsaft-core/`). B es multi-deployable →
PR con checklist. C es `sicsaft-core/` + doc. F toca `sicsaft-core/` + `web_admin/` + doc →
PR con checklist y `security-reviewer`. E arranca con su propio `aidlc-docs/`.

## 4. Definición de "listo para cliente final"

- [ ] `npm run dist:win` en una máquina limpia produce un `.exe` sin pasos manuales (Fase A + A.2).
- [ ] El `.exe` instalado en una PC sin el repo arranca los 5 servicios y muestra los portales
      tras el login (Fase A).
- [ ] Base patrimonial arranca **vacía**, con la organización/contrato/sede del cliente creados
      por el wizard (Fase B).
- [ ] Un cambio de IP de la PC tiene recuperación guiada, no requiere reinstalar (Fase C).
- [ ] El Profesional de AFT entra a la APP QR escaneando un QR de la pantalla del `.exe`, sin
      comandos (Fase D).
- [ ] Un técnico audita, saca copia, migra y actualiza el `.exe` a distancia (VPN al LAN o
      AnyDesk), sin consola — desde el portal del Administrador del Sistema (Fase F).
- [ ] APK Android: decidida (construida, o explícitamente diferida con la PWA como camino
      oficial) (Fase E).

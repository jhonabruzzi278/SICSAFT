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
| 7 | El CCP solo se sirve en `127.0.0.1:8766` (agregado 2026-09-10) | El Profesional de AFT solo puede trabajar sentado en la PC del Director; instalar el `.exe` en su propia PC crea una **segunda BPI** independiente (Fase G) |

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
  - **Alternativa descartada** (y desde 2026-09 el portal `web_admin/` ya no existe): embeber `web_admin` en el `.exe` para que el Administrador del
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

**Alcance**: `sicsaft-core/` + `ccp/` + `core/frontend/` + doc. **Multi-deployable** (PR con
checklist) — no era la intención inicial ("`sicsaft-core/` + doc"), pero al implementar apareció la
causa raíz: los portales embebidos leían su URL de Keycloak de un `ccp/.env.local` hecho a mano y
**horneado en el build** (`VITE_KEYCLOAK_ISSUER=http://192.168.1.11:58080/...`). Un cambio de IP
dejaba ese issuer muerto sin recuperación posible salvo reescribir el archivo y recompilar —
arreglar la estabilidad de IP de verdad obliga a sacar esa config del build (C.0).

- **C.0 — Config de portal en runtime, no en el build.** `static-portal-server.ts` inyecta
  `<script>window.__SICSAFT_PORTAL_CONFIG__={VITE_KEYCLOAK_ISSUER, VITE_KEYCLOAK_CLIENT_ID,
  VITE_CIS_URL}</script>` en el `index.html` de cada portal al servirlo, con el issuer resuelto en
  ese arranque (`KEYCLOAK_CONFIG.url` ya lleva la IP de LAN actual; `cisUrl` es `127.0.0.1`, no
  cambia). `ccp`/`core/frontend` (`oidc-config.ts`) leen `window.__SICSAFT_PORTAL_CONFIG__` primero
  y caen a `import.meta.env` para `npm run dev` suelto / deploys standalone (Traefik, Vercel). El
  `.env.local` hecho a mano deja de hacer falta para el `.exe`.
- **C.1 — Persistir + detectar + recuperar.** El primer arranque persiste la IP de LAN en
  `instalacion.json` (campo `ipLan`). Cada relanzamiento la compara con la IP actual (`getEstadoIpLan`);
  si cambió, el wizard muestra `PasoIpCambio` ("la IP de esta PC cambió de `X` a `Y` —
  [Reconfigurar y continuar]") antes del login. Reconfigurar (`reconfigurarIpLan`) re-registra
  `redirectUris`/`webOrigins` del client OIDC **`app-qr-sicsaft`** — el único con un origen de LAN;
  `ccp`/`core-frontend`/`sicsaft-core` están en `127.0.0.1` y no se tocan — y reescribe `ipLan`.
  `KC_HOSTNAME` **no** hace falta reescribirlo: se recalcula solo al cargar `keycloak-service.ts`
  en el relanzamiento. Backfill: una instalación anterior a Fase C (sin `ipLan`) adopta la IP
  actual como línea base la primera vez.
- **C.2** — El README de `devops/onprem/` + `sicsaft-core/README.md` + un aviso al final de
  `instalar-cliente.ps1` recomiendan una **reserva DHCP** para la PC del Director (la prevención de
  fondo).
- **C.3** (futuro, no esta fase) — Hostname `.local` vía mDNS + cert propio. Más robusto, más
  pesado; su propio incremento.

**Entrega**: un cambio de IP no deja la instalación inservible; hay un camino guiado de
recuperación de ~1 clic, y los portales embebidos ya no dependen de una IP horneada en el build.

**Decisión tomada (2026-08-29)**: C.1 (recuperación guiada) para la primera versión; C.3 (mDNS)
queda para después. Se sumó C.0 al alcance al encontrar la causa raíz.

### Fase D — La PWA de APP QR servida por el propio `.exe`

**Alcance**: `sicsaft-core/` + `app-qr-sicsaft/` (su `oidc-config.ts` gana el mismo fallback a
`window.__SICSAFT_PORTAL_CONFIG__` de Fase C.0). Sin decisiones abiertas. Dos dependencias nuevas
en `sicsaft-core`: `selfsigned` (cert autofirmado en runtime) y `qrcode` (el QR en el renderer).

- **D.1 — El `.exe` sirve `app-qr-sicsaft/dist` por HTTPS.** `static-portal-server.ts` gana
  `tls?: {key, cert}` + `host?` — con `tls` usa `https.createServer` en vez de `http`, escuchando
  en la **IP de LAN** (`obtenerIpLan()`), nunca `0.0.0.0`. El teléfono llega por la IP de LAN, y
  eso no es "contexto seguro" sin HTTPS (crypto.subtle/PKCE del login OIDC no existen). El cert es
  autofirmado (`appqr-tls.ts`, `selfsigned`), generado una vez y cacheado en `userData`, con la IP
  de LAN en el SubjectAltName; se regenera si venció o si la IP cambió (Fase C). El navegador del
  teléfono muestra un aviso la primera vez ("certificado propio") — es esperado, se acepta y
  queda. `app-qr-sicsaft/dist` entra a `extraResources` y a `prepack.cjs` (mismo patrón que ccp).
  La config OIDC inyectada usa issuer **y** `cisUrl` en la IP de LAN, no en loopback: el
  consumidor corre en el teléfono, no en esta PC (CIS ya escucha en `0.0.0.0`, y su
  `CIS_CORS_ORIGIN` ya incluye `https://<ip>:8765`).
- **D.2 — QR en la pantalla "instalación completa".** `PasoListoConLogin` muestra un `<QrAppQr>`
  con la URL `https://<ip-lan>:8765` (IPC `getUrlAppQr`, que de paso arranca el server HTTPS si
  hace falta). El Profesional de AFT lo escanea con la cámara y abre la PWA directo.

**Entrega**: el Profesional de AFT escanea el QR de la pantalla del `.exe` y entra a la PWA — sin
que nadie corra comandos ni tipee una IP. Sigue faltando la APK (Fase E) para una instalación "de
app store", pero el flujo de LAN queda **self-service de punta a punta** (escritorio + teléfono).

### Fase E — APK Android (`CORE-Q-01`)

Track aparte, su propio ciclo de diseño (Inception → Construction). Capacitor sobre
`app-qr-sicsaft/`. Preguntas abiertas: dónde vive el tooling (¿este monorepo?), keystore, y que un
**TWA no valida contra un cert autofirmado de LAN** — probablemente un WebView plano con la IP/host
configurable en el primer arranque, no un TWA. **No bloquea Fases A-D** — la PWA por navegador
(Fase D) cubre el uso mientras tanto.

### Fase G — Puesto de trabajo del Profesional de AFT en su propia PC (CCP por la red local)

> No confundir con la Fase F (portal de administración remota / `web_admin` embebido), que quedó
> **descartada** (§4). Esta fase no abre ningún canal hacia afuera de la LAN del cliente ni suma un
> portal ni un rol: expone en la LAN el mismo CCP que ya existe, para el mismo Profesional de AFT.

**Pedido (2026-09-10)**: instalar el sistema primero en la PC del Director — la **PC madre**, con UPS
y privilegios de administrador — y que el Profesional de AFT, desde **su propia PC**, entre directo
al login y al CCP contra esa PC madre, mientras el Director sigue usando su portal en la PC madre.

**Por qué no alcanzaba con lo que había** (verificado en código 2026-09-10):

| Traba | Dónde |
|---|---|
| El CCP escucha solo en `127.0.0.1:8766`: otra PC no lo ve | `static-portal-server.ts` (`host` por defecto), `ipc/handlers.ts` `asegurarServidoresPortales` |
| El client OIDC `ccp` solo acepta volver a `http://127.0.0.1:8766` | `keycloak-bootstrap.ts` `crearClientesPortales` |
| La config inyectada apunta a CIS en `127.0.0.1` — desde otra PC es ella misma | `ipc/handlers.ts` (`cisUrl`) |
| PKCE usa `crypto.subtle`, que solo existe en contexto seguro: una IP de LAN solo lo es por HTTPS | `ccp/src/lib/oidc/pkce.ts` |
| Un `fetch` de una página HTTPS a CIS o Keycloak, que van por HTTP, es contenido mixto: Firefox y los Chromium sin Local Network Access lo bloquean (el Chromium actual lo deja pasar con advertencia, solo por tratarse de una IP privada). Además, CIS no tiene ese origen en su CORS | `KC_HOSTNAME=http://…` (`keycloak-service.ts`), CIS HTTP, `CIS_CORS_ORIGIN` (`backend-configs.ts`) |
| Instalar el `.exe` en la PC del AFT corre el wizard de cero → **segunda BPI independiente** | no hay "modo cliente" en `sicsaft-core` |

**Decisión**: en la PC del Profesional de AFT **no se instala el `.exe`**. El CCP ya es una SPA web:
la PC madre lo sirve también en la LAN y la PC del AFT lo abre en el navegador, desde un acceso
directo en el escritorio. Una sola instalación = una sola BPI (Tomo III, fuente única de verdad).

- **G.1 — El `.exe` sirve el CCP también en la IP de LAN, por HTTPS.** Un segundo servidor
  estático sobre el mismo `ccp/dist`, en `https://<ip-lan>:8767` (`PUERTO_CCP_LAN`, `lan-ip.ts`),
  con el mismo certificado autofirmado de la APP QR (`appqr-tls.ts`, SAN con la IP de LAN). El de
  `127.0.0.1:8766` sigue igual para el portal embebido de la PC madre. Si el de LAN no puede
  arrancar (puerto ocupado), se loguea y la PC madre sigue funcionando: el puesto remoto es
  secundario y no puede tumbar el login del Director.
- **G.2 — Proxy de mismo origen hacia CIS y el token endpoint de Keycloak.** El servidor de LAN
  reenvía `/cis/*` → `http://127.0.0.1:56000/*` y `/kc/token` →
  `<issuer>/protocol/openid-connect/token`. Sin esto, el `fetch` de la página HTTPS a CIS y a
  Keycloak por HTTP sería contenido mixto: bloqueado en Firefox y en Chromium sin Local Network
  Access, y tolerado con advertencia en el Chromium actual (ver Limitaciones). Además, CIS no tiene
  ese origen en su CORS. Con el proxy todo es mismo origen: no se depende de lo que tolere el
  navegador del puesto ni hace falta tocar CIS. El login (`/protocol/openid-connect/auth`) es una
  navegación de página completa, no un `fetch`, así que va directo a Keycloak (`http://<ip>:58080`)
  sin proxy.
  - Solo esas dos rutas se reenvían, con destino fijo al configurar el servidor: no es un proxy
    abierto. Fuera las cabeceras hop-by-hop, `Host` del destino, timeout, y un 502 si el destino
    no responde.
  - Config inyectada: `VITE_CIS_URL=https://<ip>:8767/cis` y
    `VITE_KEYCLOAK_TOKEN_URL=https://<ip>:8767/kc/token`. `ccp/` suma solo el override opcional
    `VITE_KEYCLOAK_TOKEN_URL` (`oidc-config.ts` / `oidc-client.ts`); sin él, todo sigue igual (dev,
    Docker, portal embebido).
  - CIS no cambia: el pedido le llega desde la misma PC (el proxy) y, para el navegador, CCP y CIS
    comparten origen, así que no hay CORS de por medio. Lo que autoriza sigue siendo el JWT (`iss`
    = `KC_HOSTNAME`, igual que en el embebido).
- **G.3 — El client OIDC `ccp` acepta los dos orígenes.** `redirectUris`, `webOrigins` y
  `post.logout.redirect.uris` quedan en `http://127.0.0.1:8766` + `https://<ip-lan>:8767`. Así se
  registra en el bootstrap, y se re-sincroniza (idempotente) en cada relanzamiento
  (`getInstalacionExistente`) y en `reconfigurarIpLan`. Eso cubre las instalaciones anteriores a
  esta fase y los cambios de IP (Fase C) sin reinstalar. Mismo mecanismo que
  `reconfigurarClientAppQr`.
- **G.4 — La pantalla "listo" del `.exe` muestra el acceso del puesto.** Una tarjeta "Puesto del
  Profesional de AFT (otra PC)" con la dirección `https://<ip>:8767` y dos acciones:
  - **Copiar**.
  - **Guardar acceso directo**: un `SICSAFT CCP.url` que se lleva a la PC del AFT por pendrive o por
    red.

  Sin red local (IP de LAN = `127.0.0.1`) la tarjeta avisa que ningún otro equipo puede alcanzar
  esta PC.
- **G.5 — Firewall de Windows al instalar la PC madre.** El instalador NSIS (`scripts/installer.nsh`,
  vía `nsis.include`) agrega reglas de entrada, solo para los perfiles **Privado** y **Dominio**
  (nunca Público):
  - TCP 8765 (APP QR), 8767 (CCP del puesto), 56000 (CIS) y 58080 (Keycloak);
  - UDP 58765 (descubrimiento).

  El desinstalador las quita. Las reglas necesitan instalar "para todos los usuarios", es decir,
  con elevación de administrador: son los "máximos privilegios" del pedido. Instalado solo para el
  usuario actual, no se crean: ahí queda el permiso puntual de Windows la primera vez que el `.exe`
  escucha en la red, o el script manual `herramientas/devops/configurar-firewall-sicsaft.ps1`
  (mismas reglas, mismo alcance de perfil).

**Requisitos operativos de la PC madre** (no son código; van en el README y en la entrega):

1. **UPS**. Si la PC madre se apaga, ni el puesto del AFT ni los teléfonos pueden trabajar. La APP
   QR sí guarda los inventarios pendientes y los reenvía al volver (cola offline).
2. **IP estable**: reserva DHCP en el router (Fase C.2). El acceso directo del AFT lleva la IP; si
   cambia, se genera uno nuevo desde la pantalla "listo".
3. **Instalar como administrador** ("para todos los usuarios"), para las reglas de firewall de G.5.
4. La red de la PC madre en perfil **Privado** de Windows, no Público.
5. Sin suspensión ni hibernación de la PC madre en horario de trabajo.

**Primer ingreso desde la PC del AFT**: doble clic en el acceso directo → el navegador avisa
"certificado propio" (autofirmado, igual que la APP QR en el teléfono) → *Configuración avanzada →
Continuar*, una sola vez → *Iniciar sesión* → formulario de Keycloak con el usuario y la clave del
Profesional de AFT → CCP.

**Limitaciones conocidas (no son de esta fase)**:

- El proxy tiene un tope de inactividad del socket (120 s), pero no un límite propio de tamaño de
  cuerpo ni de conexiones concurrentes. No agrega superficie nueva —CIS ya escuchaba en la LAN y
  el mismo cliente podía golpearlo directo— pero conviene sumarle un límite de concurrencia si el
  endpoint de importación de Excel de CIS no acota ya el tamaño del cuerpo.

- *Cerrar sesión* en el CCP limpia los tokens del navegador, pero no cierra la sesión SSO de
  Keycloak (no llama a `end_session`). Un nuevo *Iniciar sesión* en esa misma PC entra sin pedir
  clave. Es aceptable en la PC personal del AFT; el logout OIDC real (`ccp/` + `core/frontend/`) se
  corrige aparte.
- La carpeta vigilada de ingesta (DOC-029 RF-B.6) vive en la PC madre. El CCP del puesto la
  muestra, pero para soltar Excel ahí desde otra PC hay que compartir esa carpeta por la red de
  Windows (fuera de alcance). La carga manual por la UI del CCP sí funciona desde el puesto: pasa
  por el proxy hacia CIS.
- **Contenido mixto en la APP QR (Fase D)**. Verificado el 2026-09-10 con Chromium 153: un `fetch`
  de `https://192.168.1.8` a `http://192.168.1.8` pasa, solo con la advertencia *"Mixed Content …
  should also be served over HTTPS"*, porque Chromium relaja el bloqueo para IP privadas (Local
  Network Access). Por eso la APP QR, que llama a CIS por HTTP desde HTTPS, funciona en teléfonos
  con Chrome actual. En Firefox o en un Chromium anterior quedaría bloqueada (no verificado). El
  proxy de G.2 no depende de esa excepción, y si hiciera falta, el mismo mecanismo resuelve la APP
  QR.
- **G.6 (futuro, no implementado)** — un "modo puesto de trabajo" en el `.exe`:
  - ventana propia, sin el aviso de certificado (con el fingerprint del cert de la PC madre fijado);
  - descubrimiento automático por el UDP de `discovery-service.ts`;
  - un aviso en el wizard si ya hay una PC madre en la red, para evitar una segunda BPI por error.

  No hace falta para operar; se evalúa con el primer cliente.

**Entrega**: el Profesional de AFT, desde su propia PC y sin instalar nada, abre el acceso directo,
inicia sesión con sus credenciales y trabaja en el CCP contra la BPI de la PC madre, al mismo tiempo
que el Director usa su portal en la PC madre.

**Verificación**:

- Unit: `static-portal-server.test.ts` (proxy, rutas permitidas, 502), `keycloak-bootstrap.test.ts`
  (orígenes del client `ccp`), `lan-ip.test.ts` y, en `ccp/`, `oidc-config` / `oidc-client`
  (token endpoint por proxy).
- e2e `20-puesto-aft-lan.spec.ts`: login real del AFT contra `https://<ip-lan>:8767` y lectura de CIS
  por el proxy, en un Chromium aparte que representa la PC del AFT.

## 3. Orden de ejecución

```
Fase A (empaquetado)         ── HECHA (PR #68)
  └─ Fase D (PWA en el .exe) ── HECHA — sicsaft-core/ + app-qr-sicsaft/oidc-config.ts
Fase B (base limpia + org)   ── HECHA (PR #69), verificada E2E
Fase C (estabilidad de IP)   ── HECHA (PR #71), verificada E2E — sumó C.0 (config de portal runtime)
Fase E (APK)                  ── track aparte, no bloquea nada de A-D
Fase G (puesto AFT en la LAN) ── HECHA (2026-09-10) — sicsaft-core/ + ccp/ (override de token endpoint)
  └─ G.6 (modo puesto en el .exe) ── futuro, no bloquea
```

`main` recibió A/B/C. D toca `sicsaft-core/` + `app-qr-sicsaft/` (un `oidc-config.ts`) → PR de
`sicsaft-core` con ese archivo extra. B fue multi-deployable con checklist. E arranca con su
propio `aidlc-docs/`.

## 4. Definición de "listo para cliente final"

- [x] `npm run dist:win` produce un `.exe` sin pasos manuales (Fase A + A.2). *Falta correrlo
      contra una PC Windows genuinamente limpia — `npm run pack` sí se corrió y produjo
      `win-unpacked` + el build de Keycloak horneado.*
- [x] El `.exe` arranca los 5 servicios y muestra los portales tras el login (Fase A, verificado
      en dev + relanzamiento post-wizard).
- [x] Base patrimonial arranca **vacía**, con la organización/contrato/sede del cliente creados
      por el wizard (Fase B) — verificado E2E (39/39, 2026-08-29).
- [x] Un cambio de IP de la PC tiene recuperación guiada, no requiere reinstalar (Fase C) —
      verificado E2E.
- [x] El Profesional de AFT entra a la APP QR escaneando un QR de la pantalla del `.exe`, sin
      comandos (Fase D).
- [x] **Nivel 2 (CCP completo)**: el vendedor lo elige en el wizard
      ([DOC-030](DOC-030-nivel-2-en-sicsaft-core-exe.md)) — el `.exe` deja de estar limitado a
      Nivel 1. Sin `web_admin/` embebido ni portal de administración remota (decisión del usuario
      2026-09-02): **Fase F queda descartada** — cualquier soporte post-instalación es presencial o
      por un paquete que el cliente envía, no un canal abierto a su PC.
- [ ] APK Android: decidida (construida, o explícitamente diferida con la PWA como camino
      oficial) (Fase E).
- [x] El Profesional de AFT trabaja en el CCP desde **su propia PC** contra la PC madre, sin
      instalar nada ni crear una segunda BPI, en simultáneo con el Director (Fase G).

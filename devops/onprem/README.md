# SICSAFT — instalación on-premise por cliente (Nivel 1 / Nivel 2)

Stack de contenedores para instalar una copia **aislada** de SICSAFT en el PC/servidor de un
cliente — un tenant completo por cliente, no una Organization más dentro de un Keycloak
compartido. Ver [`../../aidlc-docs/devops/`](../../aidlc-docs/devops) para el diseño completo
(contexto de negocio, arquitectura, niveles de producto) y
[`../README.md`](../README.md) para cómo encaja con `devops/local/`/`devops/prod/`.

Subconjunto de [`devops/local/`](../local): sin observabilidad, sin `k6`, sin dashboard de Traefik
expuesto. `cip` (BI) sí entra, desde Nivel 1 (ver `DOC-025` 1/3, cierra INST-Q-01).

## Instalación automatizada (recomendada)

```powershell
./instalar-cliente.ps1 -ClienteNombre "Municipalidad de Melipilla" `
    -OrganizacionId "municipalidad-melipilla" -Nivel 2
```

Un solo comando hace todo lo que el flujo manual de abajo describe paso a paso: verifica/instala
WSL2 y Podman, genera un `.env` con contraseñas únicas, levanta la base de identidad, corre el
bootstrap del cliente contra la Admin REST API de Keycloak (realm, roles, Organization, apps
OIDC — ver `aidlc-docs/devops/design-artifacts/ARCHITECTURE.md`), completa el `.env` y
construye/levanta el stack completo, con una verificación (`smoke check`) al final. Empaquetado
como instalador `.exe` con una UI simple: ver [`installer/`](installer).

Verificado corriendo de verdad contra Windows real (no solo en teoría) — varios bugs reales
encontrados y corregidos en el camino (ver historial de PRs `fix(devops): ...` de
`devops/onprem/`): PATH no refrescado tras `winget install`, warnings de stderr tirando el script
abajo, un `pip` roto por un shim de `uv`, `$PSScriptRoot` vacío según el contexto de invocación,
`--project-directory` (no existe en `podman-compose`, a diferencia de `docker compose`), y
volúmenes de una corrida anterior fallida quedando con credenciales viejas. El flujo manual de
abajo sigue documentado como fallback/debug si algún paso automatizado falla igual y hay que
diagnosticar a mano.

**Secretos**: `.env` (contraseñas + `KEYCLOAK_ADMIN_CLIENT_SECRET`) queda con permisos NTFS
restringidos a Administradores + SYSTEM apenas termina de usarse — una sesión sin privilegios de
administrador en el PC del cliente no puede abrirlo. A diferencia del flujo de Zitadel que esto
reemplazó (ADR-004 Fase 3), no hay un `.bootstrap/` que proteger aparte: Keycloak no
auto-provisiona ningún archivo de secretos, el bootstrap se autentica directo con las credenciales
que ya están en `.env`. El instalador deja además un log detallado (`instalacion.log`, mismos
permisos) para
diagnosticar sin depender de la ventana en pantalla. La ventana de PowerShell sigue visible por
ahora a propósito (es lo que permitió diagnosticar cada bug real de la lista de arriba) — se oculta
recién cuando el flujo esté verificado como estable, ver
`aidlc-docs/devops/requirements/REQUIREMENTS.md` INST-Q-04/05 para el detalle y los límites reales
de esta protección (no cubre a un cliente con acceso de administrador en su propia máquina).

## Runtime: Podman, no Docker Desktop

Decisión confirmada (INST-RNF-01, ver `aidlc-docs/devops/requirements/REQUIREMENTS.md`): menor
consumo de recursos en reposo, sin licenciamiento comercial de Docker Desktop.

1. Habilitar WSL2 si no está: `wsl --install` (Windows 10/11), reiniciar.
2. Instalar [Podman Desktop](https://podman-desktop.io/) o Podman CLI + `podman-compose`.
3. `podman machine init` (una sola vez) y `podman machine start`.

**Riesgo a verificar antes de usar en un cliente real** (no asumido): los `healthcheck`/
`depends_on: condition: service_healthy` que este compose usa fuerte (`core-migrate` → `core`,
`postgres`/`redis` healthy antes de levantar `cis`/`core`) deben comportarse igual bajo
`podman-compose` — probar `podman-compose --profile nivel1 up -d` de punta a punta antes de una
instalación real.

## Instalación manual (paso a paso)

Fallback/debug si `instalar-cliente.ps1` falla en algún paso y hace falta diagnosticar a mano, o
si se prefiere no usar el orquestador todavía.

### 1. Resolver los dominios locales

Igual que `devops/local/` — agregar al archivo hosts
(`C:\Windows\System32\drivers\etc\hosts`, como administrador):

```
127.0.0.1 id.sicsaft.localhost
127.0.0.1 api.sicsaft.localhost
127.0.0.1 qr.sicsaft.localhost
127.0.0.1 admin.sicsaft.localhost
127.0.0.1 directivo.sicsaft.localhost
127.0.0.1 ccp.sicsaft.localhost
```

(DOC-025 §1, rev. 2026-08-25: `admin` y `directivo` ya hacen falta desde Nivel 1 — solo `ccp` es
exclusivo de Nivel 2.)

### 2. Variables de entorno de este cliente

```bash
cp .env.example .env
```

Completar `POSTGRES_ADMIN_PASSWORD`, `REDIS_PASSWORD`, `KEYCLOAK_DB_PASSWORD`,
`KEYCLOAK_ADMIN_USERNAME`/`PASSWORD`, `CORE_DB_PASSWORD` y `CORE_SERVICE_TOKEN`
(`openssl rand -hex 32`) con valores **únicos de este cliente** (INST-RNF-03 — nunca reusar los de
otra instalación). Dejar el resto de las variables (`KEYCLOAK_ADMIN_CLIENT_ID`/`SECRET`, los
`*_CLIENT_ID`, etc.) con el placeholder hasta el paso 4.

### 3. Levantar la base de identidad primero

**No levantar todo el stack junto todavía** — el bootstrap de Keycloak necesita correr antes de
construir los frontends (ver "Orden obligatorio" abajo):

```bash
podman-compose up -d postgres redis keycloak traefik
```

Esperar a que responda 200 (Keycloak inicializó su esquema de base de datos y ya sirve tráfico):

```bash
curl http://id.sicsaft.localhost/realms/master/.well-known/openid-configuration
```

### 4. Bootstrap del cliente

A diferencia de Zitadel (que esto reemplazó, ADR-004 Fase 3) — no hace falta ningún PAT
auto-provisionado ni crear nada a mano en la Console: el bootstrap se autentica directo contra el
realm `master` con `KEYCLOAK_ADMIN_USERNAME`/`PASSWORD` (las mismas credenciales que ya arrancaron
el contenedor `keycloak`, ver `docker-compose.yml`). El script hace todo lo demás (realm `sicsaft`,
Organizations habilitado, roles, Organization del cliente, apps OIDC):

```powershell
./bootstrap-keycloak.ps1 -AdminUsername admin -AdminPassword "la-que-quedó-en-.env" `
    -ClienteNombre "Municipalidad de Melipilla" `
    -OrganizacionId "municipalidad-melipilla" `
    -Nivel 2
```

Copiar los valores que imprime al final (`KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`,
y los `*_VITE_KEYCLOAK_CLIENT_ID`) al `.env`.

> Cada llamada de este script (realm, Organizations, client scopes con Audience mapper, roles,
> clients OIDC públicos con PKCE, client confidencial con service account) se verificó real contra
> un Keycloak 26.0 de prueba (2026-08-26, ver Nota de honestidad en `lib/Bootstrap-Keycloak.psm1`)
> — incluyendo el login completo de un usuario de prueba y la inspección del JWT resultante. Lo
> que falta verificar es el flujo end-to-end contra ESTE `docker-compose.yml` (Traefik +
> `KC_HOSTNAME` con un dominio de cliente real) — probarlo de punta a punta antes de usarlo en la
> instalación de un cliente pagante.

### 5. Orden obligatorio: bootstrap antes de build

Los frontends (`app-qr-sicsaft`, `web-admin`, `core-frontend` desde Nivel 1, y `ccp` desde Nivel 2)
hornean `VITE_KEYCLOAK_CLIENT_ID` en **build time** (mismo mecanismo que `devops/local/`, ver
`args:` en `docker-compose.yml`). Construir las imágenes antes de tener los Client IDs reales de
este cliente obliga a reconstruirlas después — por eso el bootstrap (paso 4) va antes de este paso:

```bash
podman-compose --profile nivel1 up -d --build      # Nivel 1: app-qr-sicsaft + web-admin + core-frontend
# o
podman-compose --profile nivel2 up -d --build      # Nivel 2 (incluye Nivel 1 + ccp)
```

### 6. Verificar antes de cerrar la instalación

- Login real de un usuario de prueba por rol contratado (mismo criterio que
  `devops/local/README.md` para cada portal).
- APP QR (`http://qr.sicsaft.localhost`) loguea y sincroniza contra este CIS/CORE local.
- `web-admin` y `core-frontend` levantan desde Nivel 1; `ccp` recién desde Nivel 2 — cada login
  aterriza donde corresponde según el rol (DOC-025 §1, rev. 2026-08-25).

### 7. Después de verificar

- Guardar `KEYCLOAK_ADMIN_CLIENT_SECRET`, `KEYCLOAK_ADMIN_PASSWORD` y el `.env` completo de este
  cliente en el gestor de secretos del admin — necesario para volver a soportar esta instalación
  después (alta de usuarios, reset de contraseña) sin depender de que el cliente sepa operar
  Keycloak (INST-Q-02, pregunta abierta de gestión de secretos multi-cliente).
- Entregar al cliente sus credenciales de operador reales y desactivar/borrar los usuarios de
  prueba usados para verificar.

## Apagar / limpiar

```bash
podman-compose down          # detiene, conserva los volúmenes
podman-compose down -v       # borra todo — solo para reset completo de esta instalación
```

## Estado del instalador `.exe` empaquetado

Ya existe el código fuente (`instalar-cliente.ps1` + `installer/sicsaft-onprem.iss`) que cierra
los 8 pasos manuales de arriba en un solo flujo — ver "Instalación automatizada" al inicio de este
README y [`installer/README.md`](installer/README.md) para el estado real de verificación
(todavía no corrido de punta a punta contra una máquina Windows limpia).

## Nivel 3 (RFID)

No implementado — `rfid/` está "No iniciado" en `ROADMAP.md`, no hay código que empaquetar
todavía. Ver `aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md`.

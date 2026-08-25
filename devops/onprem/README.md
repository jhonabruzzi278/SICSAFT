# SICSAFT — instalación on-premise por cliente (Nivel 1 / Nivel 2)

Stack de contenedores para instalar una copia **aislada** de SICSAFT en el PC/servidor de un
cliente — un tenant completo por cliente, no una Organización más dentro de un Zitadel
compartido. Ver [`../../aidlc-docs/devops/`](../../aidlc-docs/devops) para el diseño completo
(contexto de negocio, arquitectura, niveles de producto) y
[`../README.md`](../README.md) para cómo encaja con `devops/local/`/`devops/prod/`.

Subconjunto de [`devops/local/`](../local): sin observabilidad, sin `k6`, sin `cip` (fuera de los
3 niveles de producto, ver `DOC-025`), sin dashboard de Traefik expuesto.

## Instalación automatizada (recomendada)

```powershell
./instalar-cliente.ps1 -ClienteNombre "Municipalidad de Melipilla" `
    -OrganizacionId "municipalidad-melipilla" -Nivel 2
```

Un solo comando hace todo lo que el flujo manual de abajo describe paso a paso: verifica/instala
WSL2 y Podman, genera un `.env` con contraseñas únicas, levanta la base de identidad, obtiene el
PAT de Zitadel solo (auto-provisionado, sin Console — ver
`aidlc-docs/devops/design-artifacts/ARCHITECTURE.md`), corre el bootstrap del cliente, completa el
`.env` y construye/levanta el stack completo, con una verificación (`smoke check`) al final.
Empaquetado como instalador `.exe` con una UI simple: ver [`installer/`](installer).

Verificado corriendo de verdad contra Windows real (no solo en teoría) — varios bugs reales
encontrados y corregidos en el camino (ver historial de PRs `fix(devops): ...` de
`devops/onprem/`): PATH no refrescado tras `winget install`, warnings de stderr tirando el script
abajo, un `pip` roto por un shim de `uv`, `$PSScriptRoot` vacío según el contexto de invocación,
`--project-directory` (no existe en `podman-compose`, a diferencia de `docker compose`), y
volúmenes de una corrida anterior fallida quedando con credenciales viejas. El flujo manual de
abajo sigue documentado como fallback/debug si algún paso automatizado falla igual y hay que
diagnosticar a mano.

**Secretos**: `.env` (contraseñas + `ZITADEL_ADMIN_TOKEN`) y `.bootstrap/` (el PAT
auto-provisionado) quedan con permisos NTFS restringidos a Administradores + SYSTEM apenas
terminan de usarse — una sesión sin privilegios de administrador en el PC del cliente no puede
abrirlos. El instalador deja además un log detallado (`instalacion.log`, mismos permisos) para
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
127.0.0.1 ccp.sicsaft.localhost
127.0.0.1 admin.sicsaft.localhost
127.0.0.1 directivo.sicsaft.localhost
```

(Las últimas 3 solo hacen falta en instalaciones Nivel 2.)

### 2. Variables de entorno de este cliente

```bash
cp .env.example .env
```

Completar `POSTGRES_ADMIN_PASSWORD`, `REDIS_PASSWORD`, `ZITADEL_MASTERKEY` (32 caracteres exactos:
`openssl rand -base64 32 | cut -c1-32`), `ZITADEL_ADMIN_USERNAME`/`PASSWORD`, `CORE_DB_PASSWORD` y
`CORE_SERVICE_TOKEN` (`openssl rand -hex 32`) con valores **únicos de este cliente** (INST-RNF-03
— nunca reusar los de otra instalación). Dejar el resto de las variables (`CIS_ZITADEL_AUDIENCE`,
`ZITADEL_ORG_ID_MAP`, los `*_CLIENT_ID`, etc.) con el placeholder hasta el paso 4.

### 3. Levantar la base de identidad primero

**No levantar todo el stack junto todavía** — el bootstrap de Zitadel necesita correr antes de
construir los frontends (ver "Orden obligatorio" abajo):

```bash
podman-compose up -d postgres redis zitadel
podman-compose logs -f zitadel   # esperar a que termine el bootstrap (start-from-init)
```

### 4. Bootstrap del cliente

Requiere un Personal Access Token (PAT) de un service user con rol IAM/Org Manager. Con este
compose ya no hace falta crearlo a mano en la Console: Zitadel lo auto-provisiona en el primer
arranque (`ZITADEL_FIRSTINSTANCE_ORG_MACHINE_*`/`PATPATH`, ver `docker-compose.yml`) y lo escribe
en `.bootstrap/admin-pat.txt` — leerlo de ahí después de `podman-compose up -d zitadel`. Si por lo
que sea ese mecanismo no funcionara en la práctica, queda como respaldo crear el service user a
mano en la Console, mismo paso que documenta
[`devops/local/README.md` "Rol administrador-sistema + integración Zitadel Admin API"](../local/README.md#rol-administrador-sistema--integración-zitadel-admin-api-web--doc-021)
(sección 2). Todo lo que viene después de tener el PAT lo hace el script:

```powershell
./bootstrap-zitadel.ps1 -Pat "pat_xxx" `
    -ClienteNombre "Municipalidad de Melipilla" `
    -OrganizacionId "municipalidad-melipilla" `
    -Nivel 2
```

Copiar los valores que imprime al final (`CIS_ZITADEL_AUDIENCE`, `ZITADEL_ORG_ID_MAP`,
`ZITADEL_ADMIN_TOKEN`, `ZITADEL_PROJECT_ID`, y los `*_CLIENT_ID`) al `.env`.

> ⚠️ El script no está verificado todavía contra una instancia real de Zitadel (ver el
> encabezado del propio `bootstrap-zitadel.ps1`) — probarlo de punta a punta antes de usarlo en
> la instalación de un cliente pagante. Si algún shape de la API difiere, corregir el script, no
> volver a los pasos manuales del dashboard salvo que sea estrictamente necesario.

### 5. Orden obligatorio: bootstrap antes de build

Los frontends (`app-qr-sicsaft`, y en Nivel 2 `ccp`/`web-admin`/`core-frontend`) hornean
`VITE_ZITADEL_CLIENT_ID` en **build time** (mismo mecanismo que `devops/local/`, ver `args:` en
`docker-compose.yml`). Construir las imágenes antes de tener los Client IDs reales de este cliente
obliga a reconstruirlas después — por eso el bootstrap (paso 4) va antes de este paso:

```bash
podman-compose --profile nivel1 up -d --build      # Nivel 1
# o
podman-compose --profile nivel2 up -d --build      # Nivel 2 (incluye Nivel 1 + los 3 portales)
```

### 6. Verificar antes de cerrar la instalación

- Login real de un usuario de prueba por rol contratado (mismo criterio que
  `devops/local/README.md` para cada portal).
- APP QR (`http://qr.sicsaft.localhost`) loguea y sincroniza contra este CIS/CORE local.
- Nivel 2: `ccp`/`web-admin`/`core-frontend` levantan y cada login aterriza donde corresponde según
  el rol.

### 7. Después de verificar

- Guardar `ZITADEL_ADMIN_TOKEN` y el `.env` completo de este cliente en el gestor de secretos del
  admin — necesario para volver a soportar esta instalación después (alta de usuarios, reset de
  contraseña) sin depender de que el cliente sepa operar Zitadel (INST-Q-02, pregunta abierta de
  gestión de secretos multi-cliente).
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

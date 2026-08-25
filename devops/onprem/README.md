# SICSAFT — instalación on-premise por cliente (Nivel 1 / Nivel 2)

Stack de contenedores para instalar una copia **aislada** de SICSAFT en el PC/servidor de un
cliente — un tenant completo por cliente, no una Organización más dentro de un Zitadel
compartido. Ver [`../../aidlc-docs/devops/`](../../aidlc-docs/devops) para el diseño completo
(contexto de negocio, arquitectura, niveles de producto) y
[`../README.md`](../README.md) para cómo encaja con `devops/local/`/`devops/prod/`.

Subconjunto de [`devops/local/`](../local): sin observabilidad, sin `k6`, sin `cip` (fuera de los
3 niveles de producto, ver `DOC-025`), sin dashboard de Traefik expuesto.

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

## 1. Resolver los dominios locales

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

## 2. Variables de entorno de este cliente

```bash
cp .env.example .env
```

Completar `POSTGRES_ADMIN_PASSWORD`, `REDIS_PASSWORD`, `ZITADEL_MASTERKEY` (32 caracteres exactos:
`openssl rand -base64 32 | cut -c1-32`), `ZITADEL_ADMIN_USERNAME`/`PASSWORD`, `CORE_DB_PASSWORD` y
`CORE_SERVICE_TOKEN` (`openssl rand -hex 32`) con valores **únicos de este cliente** (INST-RNF-03
— nunca reusar los de otra instalación). Dejar el resto de las variables (`CIS_ZITADEL_AUDIENCE`,
`ZITADEL_ORG_ID_MAP`, los `*_CLIENT_ID`, etc.) con el placeholder hasta el paso 4.

## 3. Levantar la base de identidad primero

**No levantar todo el stack junto todavía** — el bootstrap de Zitadel necesita correr antes de
construir los frontends (ver "Orden obligatorio" abajo):

```bash
podman-compose up -d postgres redis zitadel
podman-compose logs -f zitadel   # esperar a que termine el bootstrap (start-from-init)
```

## 4. Bootstrap del cliente

Requiere un Personal Access Token (PAT) de un service user con rol IAM/Org Manager — mismo paso
manual, una sola vez por instancia de Zitadel, que ya documenta
[`devops/local/README.md` "Rol administrador-sistema + integración Zitadel Admin API"](../local/README.md#rol-administrador-sistema--integración-zitadel-admin-api-web--doc-021)
(sección 2). Todo lo que viene después de tener ese PAT lo hace el script:

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

## 5. Orden obligatorio: bootstrap antes de build

Los frontends (`app-qr-sicsaft`, y en Nivel 2 `ccp`/`web-admin`/`core-frontend`) hornean
`VITE_ZITADEL_CLIENT_ID` en **build time** (mismo mecanismo que `devops/local/`, ver `args:` en
`docker-compose.yml`). Construir las imágenes antes de tener los Client IDs reales de este cliente
obliga a reconstruirlas después — por eso el bootstrap (paso 4) va antes de este paso:

```bash
podman-compose --profile nivel1 up -d --build      # Nivel 1
# o
podman-compose --profile nivel2 up -d --build      # Nivel 2 (incluye Nivel 1 + los 3 portales)
```

## 6. Verificar antes de cerrar la instalación

- Login real de un usuario de prueba por rol contratado (mismo criterio que
  `devops/local/README.md` para cada portal).
- APP QR (`http://qr.sicsaft.localhost`) loguea y sincroniza contra este CIS/CORE local.
- Nivel 2: `ccp`/`web-admin`/`core-frontend` levantan y cada login aterriza donde corresponde según
  el rol.

## 7. Después de verificar

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

## Qué falta para el instalador `.exe` empaquetado

Este incremento entrega el stack parametrizado + el bootstrap, verificables a mano. Falta
(incremento siguiente, ver `aidlc-docs/devops/design-artifacts/ARCHITECTURE.md` "Fase 3"):
detección/instalación automática de WSL2 + Podman, un wizard simple para generar el `.env`, y
empaquetado con Inno Setup o NSIS — a verificar primero contra una máquina Windows limpia real.

## Nivel 3 (RFID)

No implementado — `rfid/` está "No iniciado" en `ROADMAP.md`, no hay código que empaquetar
todavía. Ver `aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md`.

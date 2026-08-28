# `resources/` — binarios embebidos

No versionado en git (ver `.gitignore`) — cada carpeta de acá abajo tiene que existir con estos
binarios adentro antes de poder correr `npm run dev`/`npm run build` de verdad. Vendorizado real
por primera vez el 2026-08-27, verificado arrancando cada binario de punta a punta (no solo
descomprimido).

> Los hallazgos de Keycloak de abajo están también en
> [DOC-027](../../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md)
> BUG-23/24/25 (versión rota de `/organizations/members`, opciones build-time, puerto de
> management del health-check), junto con el resto de la bitácora de bugs de esta línea de
> trabajo.

- **`postgres/`** — PostgreSQL **16.15-1**, binarios oficiales portables de Windows x64 que
  publica EDB (EnterpriseDB): `postgresql-16.15-1-windows-x64-binaries.zip`
  (`get.enterprisedb.com/postgresql/...`). Solo se vendorizan `bin/`, `lib/` y `share/` (locale,
  timezone data, diccionarios de `tsearch`) — se descartan `pgAdmin 4/`, `StackBuilder/`, `doc/` e
  `include/` del ZIP original, que no hacen falta para un server headless embebido (reduce el
  footprint de ~330MB a ~100MB). **Ojo con la extracción**: hay que descomprimir el ZIP completo
  y mover `bin/`/`lib/`/`share/` ya extraídos — extraer con un patrón selectivo tipo
  `unzip zip "pgsql/share/*"` NO trae subcarpetas anidadas (`share/timezonesets/`,
  `share/tsearch_data/`, etc. quedan afuera — `initdb.exe` falla real con "could not open
  directory ... timezonesets" si falta esto).
- **`keycloak/`** — Keycloak **26.0.8** (NO 26.0.0 — ver hallazgo real abajo), ZIP oficial de
  `github.com/keycloak/keycloak/releases` (`keycloak-26.0.8.zip`), descomprimido completo (flatten
  del único folder top-level del ZIP).
  - **Hallazgo real sobre la versión exacta**: `POST /organizations/{id}/members` (usado por
    `keycloak-bootstrap.ts` `crearGrant`, alta del Director) está roto en Keycloak 26.0.0-26.0.5 —
    responde `HTTP 400 "User does not exist"` incluso con el body/headers correctos, un bug real de
    Keycloak arreglado en 26.0.6 (confirmado contra un Keycloak 26.0.0 real hoy, y contra un
    26.0.8 real después — ver
    [discusión oficial](https://github.com/keycloak/keycloak/discussions/34230)). `devops/onprem/
    docker-compose.yml` usa el tag flotante `26.0` de la imagen oficial (probablemente ya resuelto
    a un patch reciente a esta fecha) — acá, al vendorizar un ZIP fijo, hay que elegir el patch a
    mano: 26.0.8 es el último de la rama 26.0.x disponible hoy.
  - **`keycloak/jre/`** — Eclipse Temurin JRE **17.0.20.1+1** Windows x64, ZIP oficial de
    `github.com/adoptium/temurin17-binaries/releases` — `kc.bat` no trae su propio JRE, necesita
    uno vendorizado aparte (ver `JAVA_HOME`/`JRE_HOME` en `keycloak-service.ts`).
  - **Paso de empaquetado obligatorio, no automático todavía**: después de vendorizar, correr una
    vez `JAVA_HOME=<ruta>/jre JRE_HOME=<ruta>/jre kc.bat build --db=postgres --health-enabled=true`
    dentro de `keycloak/bin/` — sin esto, `kc.bat start --optimized` (lo que usa
    `keycloak-service.ts`) tira "ERROR: build time options have values that differ from what is
    persisted" y el proceso muere sin arrancar (`--db`/`--health-enabled` son opciones de BUILD
    TIME en Keycloak 26, no de runtime — hallazgo real, no documentado en la guía oficial de forma
    obvia). Pendiente automatizarlo como paso de `electron-builder` (ver
    `aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md` "Próximo paso sugerido").
  - **Hallazgo real sobre el health-check**: Keycloak 26 expone `/health/ready` en una interfaz de
    **management separada** del puerto HTTP principal (default 9000, acá fijo en
    `KC_HTTP_MANAGEMENT_PORT`/`PUERTO_KEYCLOAK_MANAGEMENT` = 58081) — `GET
    http://127.0.0.1:<puerto HTTP>/health/ready` nunca responde. `keycloak-service.ts` ya apunta
    al puerto correcto.

Sin `redis/`: [ADR-005](../../adr/ADR-005-postgres-pgboss-reemplaza-redis.md) (2026-08-27) sacó a
Redis del ecosistema completo — `cis/` mueve su rate-limiter/device-registry a memoria del propio
proceso, y la cola CORE→CIP pasa a `pg-boss` sobre el mismo Postgres de arriba. Un binario menos
que vendorizar acá.

`cis/`, `core/` y `cip/` **no** se vendorizan en `resources/` para desarrollo local — en modo
`npm run dev`, `node-backend-service.ts` (`rutaDistDeSistema`) resuelve directo el `dist/main.js`
ya compilado de cada uno como hermano de este repo (`../../<sistema>/dist/main.js`), sin copiar
nada. Solo el empaquetado final (`npm run dist:win`, `electron-builder`) necesita copiarlos acá —
pendiente, ver `00_PROJECT_METADATA.md`.

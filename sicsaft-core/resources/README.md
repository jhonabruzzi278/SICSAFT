# `resources/` — binarios embebidos (pendientes de vendorizar)

No versionado en git (ver `.gitignore`) — cada carpeta de acá abajo tiene que existir con estos
binarios adentro antes de poder correr `npm run dev`/`npm run build` de verdad:

- **`postgres/bin/`** — `initdb.exe`, `pg_ctl.exe`, `postgres.exe` del ZIP portable oficial de
  Windows que publica EDB (EnterpriseDB) — sin instalador, se descomprime directo acá.
- **`keycloak/`** — un JRE redistribuible (Eclipse Temurin, Windows) + la distribución ZIP oficial
  de Keycloak, ya compilada con `kc.bat build` (no `--optimized` sin ese paso primero, ver la nota
  real en `devops/onprem/docker-compose.yml` sobre este mismo error).

Sin `redis/`: [ADR-005](../../adr/ADR-005-postgres-pgboss-reemplaza-redis.md) (2026-08-27) sacó a
Redis del ecosistema completo — `cis/` mueve su rate-limiter/device-registry a memoria del propio
proceso, y la cola CORE→CIP pasa a `pg-boss` sobre el mismo Postgres de arriba. Un binario menos
que vendorizar acá.

Ver `aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md` "Próximo paso sugerido" para el estado real
de este pendiente.

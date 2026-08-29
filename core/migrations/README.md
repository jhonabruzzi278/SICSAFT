# `core/migrations/` — esquema versionado de la Base Patrimonial

`node-pg-migrate` sobre `core/scripts/migrate.js` (JS plano, sin devDependencies — corre en la
imagen de producción). `npm run migrate:up` / `npm run migrate:down`. El mismo runner lo usan el
servicio `core-migrate` de `devops/` y el `.exe` embebido de `sicsaft-core/`
(`src/main/services/migration-runner.ts`).

## Seeds de desarrollo — `SICSAFT_SEED_DEV`

Las migraciones `1755000000001_seed-dev-fixture.ts` y `1755100000001_seed-dev-fixture-patrimonial.ts`
cargan el caso de negocio de prueba **DUOC UC / Melipilla** (organización, contrato, sedes, un
área, un responsable, una ubicación, dos activos con su alta e inventario). **NO** es el mecanismo
de carga de datos de producción — eso es la importación real vía el rol Administrador Patrimonial
(Tomo III 1.4).

Desde **DOC-028 Fase B.1**, esas dos migraciones **solo insertan si `SICSAFT_SEED_DEV=1`**.
node-pg-migrate igual las registra como aplicadas en `pgmigrations`, así que el estado de
migraciones es idéntico en todos los entornos — cambia solo si los `INSERT` corren o no.

| Contexto | `SICSAFT_SEED_DEV` | Resultado |
|---|---|---|
| CI e2e de `core/` (`core-ci.yml`) | `1` | fixture cargado (los e2e dependen de él) |
| `devops/local/docker-compose.yml` (`core-migrate`) | `1` | fixture cargado (para poke a mano) |
| `.exe` embebido (`sicsaft-core`) | *(sin setear)* | **base patrimonial limpia** |
| `devops/prod` | *(sin setear)* | **base patrimonial limpia** |
| `devops/onprem` (instalación por cliente) | *(sin setear)* | **base patrimonial limpia** |

Para correr los e2e de `core/` en local:

```bash
SICSAFT_SEED_DEV=1 npm run migrate:up
npm run test:e2e
```

La organización real de un cliente (en el `.exe`) la crea el wizard de primer arranque de
`sicsaft-core` — `provisionarOrganizacionCore` inserta `organizaciones` + `contratos` + `sedes` +
`contrato_sedes` con los datos que tipea el vendedor (DOC-028 Fase B.2).

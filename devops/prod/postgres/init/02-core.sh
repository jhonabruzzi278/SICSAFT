#!/bin/sh
# Crea la base y el usuario dedicados a CORE/Base Patrimonial — nunca comparte base con Zitadel
# (ver 01-zitadel.sh, mismo patron). El esquema en si (tablas, seed de desarrollo) ya NO se
# aplica acá: lo aplica el servicio `core-migrate` de docker-compose.yml corriendo
# `node scripts/migrate.js up` (core/migrations/, node-pg-migrate) contra esta base vacia, la
# misma migracion que corre en CI (ver .github/workflows/core-ci.yml) — asi el esquema queda
# versionado y reversible en vez de un .sql sin historial aplicado a mano.
#
# Copia de devops/local/postgres/init/02-core.sh — ver devops/prod/README.md "Hallazgo real"
# (Coolify no resuelve de forma confiable un bind mount cuyo origen usa `..`). Si edita este
# script, replique el cambio en devops/local/postgres/init/02-core.sh (o viceversa).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${CORE_DB_USER}" WITH PASSWORD '${CORE_DB_PASSWORD}';
    CREATE DATABASE core OWNER "${CORE_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE core TO "${CORE_DB_USER}";
EOSQL

# pgaudit sobre la Base Patrimonial (regla no negociable del ecosistema: nunca escritura directa
# fuera de CORE, ver CLAUDE.md raiz) -- shared_preload_libraries ya lo carga a nivel de servidor
# (ver command: en docker-compose.yml), acá solo se habilita la extension en esta base
# especifica. CIP tiene sus propias tablas de agregacion; se puede sumar con el mismo patron si
# hace falta auditarlas tambien.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "core" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS pgaudit;
EOSQL

#!/bin/sh
# Crea la base y el usuario dedicados a CIP — separada de `core` (RNF-01, DOC-014: CIP nunca
# consulta la Base Patrimonial transaccional directamente, solo su propio almacen de lectura).
# Mismo patron que 02-core.sh. El esquema (tablas de agregados) lo aplica el servicio
# `cip-migrate` de docker-compose.yml corriendo `node scripts/migrate.js up`
# (cip/migrations/, node-pg-migrate), no este script.
#
# Copia de devops/local/postgres/init/03-cip.sh — ver devops/prod/README.md "Hallazgo real"
# (Coolify no resuelve de forma confiable un bind mount cuyo origen usa `..`). Si edita este
# script, replique el cambio en devops/local/postgres/init/03-cip.sh (o viceversa).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${CIP_DB_USER}" WITH PASSWORD '${CIP_DB_PASSWORD}';
    CREATE DATABASE cip OWNER "${CIP_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE cip TO "${CIP_DB_USER}";
EOSQL

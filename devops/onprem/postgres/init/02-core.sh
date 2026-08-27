#!/bin/sh
# Crea la base y el usuario dedicados a CORE/Base Patrimonial — nunca comparte base con Keycloak.
# El esquema en si lo aplica el servicio `core-migrate` (node-pg-migrate), no este script. Copia
# identica de devops/local/postgres/init/02-core.sh.
#
# CIP tiene su propio script aparte (03-cip.sh) -- entra en Nivel 1 onprem desde 2026-08-25
# (DOC-025 3, cierra INST-Q-01).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${CORE_DB_USER}" WITH PASSWORD '${CORE_DB_PASSWORD}';
    CREATE DATABASE core OWNER "${CORE_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE core TO "${CORE_DB_USER}";
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "core" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS pgaudit;
EOSQL

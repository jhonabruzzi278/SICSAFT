#!/bin/sh
# Crea la base y el usuario dedicados a CORE/Base Patrimonial — nunca comparte base con Zitadel.
# El esquema en si lo aplica el servicio `core-migrate` (node-pg-migrate), no este script. Copia
# identica de devops/local/postgres/init/02-core.sh.
#
# Sin script para CIP a proposito (a diferencia de devops/local/): CIP no entra en ningun nivel de
# producto onprem (ver aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md 3),
# asi que este .env no necesita CIP_DB_USER/CIP_DB_PASSWORD.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${CORE_DB_USER}" WITH PASSWORD '${CORE_DB_PASSWORD}';
    CREATE DATABASE core OWNER "${CORE_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE core TO "${CORE_DB_USER}";
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "core" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS pgaudit;
EOSQL

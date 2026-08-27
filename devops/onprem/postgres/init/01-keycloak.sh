#!/bin/sh
# Crea la base y el usuario dedicados a Keycloak (ADR-004) — nunca comparte base con CORE/Base
# Patrimonial. Reemplaza a 01-zitadel.sh, mismo patrón (era "Copia identica de
# devops/local/postgres/init/01-zitadel.sh"; devops/local/ todavía no migró, ver README.md).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${KEYCLOAK_DB_USER}" WITH PASSWORD '${KEYCLOAK_DB_PASSWORD}';
    CREATE DATABASE keycloak OWNER "${KEYCLOAK_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE keycloak TO "${KEYCLOAK_DB_USER}";
EOSQL

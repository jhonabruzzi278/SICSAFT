#!/bin/sh
# Crea la base y el usuario dedicados a Zitadel — nunca comparte base con CORE/Base Patrimonial.
# Copia identica de devops/local/postgres/init/01-zitadel.sh.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${ZITADEL_DB_USER}" WITH PASSWORD '${ZITADEL_DB_PASSWORD}';
    CREATE DATABASE zitadel OWNER "${ZITADEL_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE zitadel TO "${ZITADEL_DB_USER}";
EOSQL

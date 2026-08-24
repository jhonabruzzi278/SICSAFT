#!/bin/sh
# Crea la base y el usuario dedicados a Zitadel — nunca comparte base con CORE/Base Patrimonial.
# docker-entrypoint-initdb.d ejecuta este script con las env vars del contenedor postgres ya
# disponibles (ZITADEL_DB_USER/ZITADEL_DB_PASSWORD, ver docker-compose.yml).
#
# Copia de devops/local/postgres/init/01-zitadel.sh — ver devops/prod/README.md "Hallazgo real"
# (Coolify no resuelve de forma confiable un bind mount cuyo origen usa `..`). Si edita este
# script, replique el cambio en devops/local/postgres/init/01-zitadel.sh (o viceversa).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${ZITADEL_DB_USER}" WITH PASSWORD '${ZITADEL_DB_PASSWORD}';
    CREATE DATABASE zitadel OWNER "${ZITADEL_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE zitadel TO "${ZITADEL_DB_USER}";
EOSQL

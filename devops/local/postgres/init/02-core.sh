#!/bin/sh
# Crea la base y el usuario dedicados a CORE/Base Patrimonial — nunca comparte base con Zitadel
# (ver 01-zitadel.sh, mismo patron). Aplica el esquema de base-patrimonial/DOC-004-modelo-contrato.md
# desde schema/core.sql, reusado tal cual por CI (ver .github/workflows/core-ci.yml) para que
# nunca se desincronice del esquema real.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${CORE_DB_USER}" WITH PASSWORD '${CORE_DB_PASSWORD}';
    CREATE DATABASE core OWNER "${CORE_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE core TO "${CORE_DB_USER}";
EOSQL

# Corre el esquema como el usuario `core`, no como `$POSTGRES_USER` — ser OWNER de la base no
# implica ser dueño de las tablas que otro rol crea dentro de ella, y sin esto `core` (el usuario
# que la app usa en runtime) queda sin privilegios sobre sus propias tablas
# ("permission denied for table contratos"). La imagen oficial habilita trust para conexiones
# locales durante el init, asi que no requiere password acá.
psql -v ON_ERROR_STOP=1 --username "${CORE_DB_USER}" --dbname core \
    -f /docker-entrypoint-initdb.d/schema/core.sql

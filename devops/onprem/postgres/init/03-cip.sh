#!/bin/sh
# Crea la base y el usuario dedicados a CIP — separada de `core` (RNF-01, DOC-014: CIP nunca
# consulta la Base Patrimonial transaccional directamente, solo su propio almacen de lectura).
# Mismo patron que 02-core.sh y que devops/local/postgres/init/03-cip.sh. El esquema (tablas de
# agregados) lo aplica el servicio `cip-migrate` de docker-compose.yml corriendo
# `node scripts/migrate.js up` (cip/migrations/, node-pg-migrate), no este script.
#
# CIP se agrego a Nivel 1 on-premise el 2026-08-25 (DOC-025 3, cierra INST-Q-01) — antes solo
# vivia en devops/local/. IMPORTANTE: este archivo debe mantener line endings LF (ver
# .gitattributes raiz) — CRLF rompe el shebang dentro del contenedor Linux de Postgres (bug real
# ya encontrado una vez con 02-core.sh, ver .gitattributes para el detalle completo).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${CIP_DB_USER}" WITH PASSWORD '${CIP_DB_PASSWORD}';
    CREATE DATABASE cip OWNER "${CIP_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE cip TO "${CIP_DB_USER}";
EOSQL

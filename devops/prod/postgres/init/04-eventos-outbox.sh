#!/bin/sh
# ADR-005 — base dedicada para la cola de eventos CORE→CIP (pg-boss), separada de las bases
# `core`/`cip` a propósito (RNF-01/RNF-05, mismo patrón que 02-core.sh/03-cip.sh): ninguno de los
# dos sistemas se da acceso a la base de datos del otro, esta es infraestructura de mensajería
# explícitamente compartida (mismo tipo de recurso que Redis ya era antes de este ADR) — un único
# usuario, que tanto `core` como `cip` reciben en su propio EVENTOS_OUTBOX_DATABASE_URL. El
# esquema en sí (tablas de pg-boss) no lo aplica este script — lo migra pg-boss solo
# (`boss.start()`) la primera vez que arranca cualquiera de los dos procesos.
#
# Copia de devops/local/postgres/init/04-eventos-outbox.sh — ver devops/prod/README.md "Hallazgo
# real" (Coolify no resuelve de forma confiable un bind mount cuyo origen usa `..`). Si edita este
# script, replique el cambio en devops/local/postgres/init/04-eventos-outbox.sh (o viceversa).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER "${EVENTOS_OUTBOX_DB_USER}" WITH PASSWORD '${EVENTOS_OUTBOX_DB_PASSWORD}';
    CREATE DATABASE eventos_outbox OWNER "${EVENTOS_OUTBOX_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE eventos_outbox TO "${EVENTOS_OUTBOX_DB_USER}";
EOSQL

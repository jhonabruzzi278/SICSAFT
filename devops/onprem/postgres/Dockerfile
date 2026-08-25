# Copia identica de devops/local/postgres/Dockerfile — pgaudit no viene precompilado en
# postgres:16-alpine, bookworm ya trae el repo PGDG con postgresql-16-pgaudit listo para instalar.
# Copia propia (no build context ../local/postgres) para que devops/onprem/ quede autocontenido y
# no dependa de que devops/local/ exista tal cual en el PC del cliente — mismo criterio que ya usa
# devops/prod/postgres/Dockerfile (ver ese README para el porqué original, relacionado a Coolify,
# pero el resultado de "carpeta autocontenida" aplica igual acá).
FROM postgres:16-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgaudit \
    && rm -rf /var/lib/apt/lists/*

USER postgres

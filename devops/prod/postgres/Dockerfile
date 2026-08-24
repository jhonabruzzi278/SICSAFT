# postgres:16-alpine (usado hasta ahora) no tiene un paquete pgaudit precompilado -- alpine
# obligaria a compilarlo desde fuente contra postgresql-dev. bookworm (Debian) es la base de la
# imagen oficial de postgres y ya trae el repo PGDG configurado, con postgresql-16-pgaudit listo
# para `apt-get install` sin compilar nada a mano. Cambia el tamano de imagen (bookworm > alpine)
# a cambio de una instalacion de una linea, mantenible.
#
# Copia de devops/local/postgres/Dockerfile — antes un `build.context` relativo
# (../local/postgres) desde devops/prod/docker-compose.yml, pero Coolify no resuelve de forma
# confiable una ruta que "escapa" del directorio del compose file con `..` (ver
# devops/prod/README.md "Hallazgo real"). Si edita este Dockerfile, replique el cambio en
# devops/local/postgres/Dockerfile (o viceversa), no hay sincronización automática.
FROM postgres:16-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgaudit \
    && rm -rf /var/lib/apt/lists/*

# El entrypoint oficial ya hace gosu postgres internamente aunque no haya USER explicito, asi que
# esto no cambia el proceso que realmente corre -- pero sin esto Sonar (docker:S6471) marca la
# imagen como "root por default" a nivel de metadata, y algunos tooling (docker exec sin --user)
# heredarian root innecesariamente. Probado explicitamente antes de este commit: recupera bien
# datos ya escritos por una corrida anterior sin este USER (init/entrypoint no se rompe).
USER postgres

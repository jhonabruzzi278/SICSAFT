# postgres:16-alpine (usado hasta ahora) no tiene un paquete pgaudit precompilado -- alpine
# obligaria a compilarlo desde fuente contra postgresql-dev. bookworm (Debian) es la base de la
# imagen oficial de postgres y ya trae el repo PGDG configurado, con postgresql-16-pgaudit listo
# para `apt-get install` sin compilar nada a mano. Cambia el tamano de imagen (bookworm > alpine)
# a cambio de una instalacion de una linea, mantenible.
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

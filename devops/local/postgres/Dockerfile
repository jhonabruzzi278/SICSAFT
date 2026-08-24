# postgres:16-alpine (usado hasta ahora) no tiene un paquete pgaudit precompilado -- alpine
# obligaria a compilarlo desde fuente contra postgresql-dev. bookworm (Debian) es la base de la
# imagen oficial de postgres y ya trae el repo PGDG configurado, con postgresql-16-pgaudit listo
# para `apt-get install` sin compilar nada a mano. Cambia el tamano de imagen (bookworm > alpine)
# a cambio de una instalacion de una linea, mantenible.
# Sin USER explicito a proposito: el entrypoint oficial de este image necesita arrancar como
# root para corregir permisos del data directory / correr initdb, y recien ahi baja privilegios
# el solo via gosu hacia el usuario "postgres" antes de ejecutar el proceso real -- forzar
# USER postgres acá rompe esa inicializacion. Sonar (docker:S6471) marca esto igual porque solo
# inspecciona el Dockerfile, no el entrypoint -- ver .sonarcloud.properties, Dockerfile no admite
# comentario al final de la linea FROM (rompe el parser: "FROM requires either one or three
# arguments", probado antes de este commit) asi que la exclusion va por properties, no inline.
FROM postgres:16-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgaudit \
    && rm -rf /var/lib/apt/lists/*

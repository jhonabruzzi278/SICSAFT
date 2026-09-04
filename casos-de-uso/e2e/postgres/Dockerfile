# pgaudit sobre postgres:16-bookworm — mismo resultado que devops/onprem/postgres/Dockerfile, con
# dos workarounds para entornos con proxy de salida (p.ej. el proxy de Docker Desktop,
# http.docker.internal:3128, que devuelve 403 para apt sobre HTTP:80):
#   1. mirrors de apt forzados a HTTPS.
#   2. bundle de CA copiado de node:24-alpine — postgres:16-bookworm no trae `ca-certificates`, y
#      sin él la verificación TLS de apt falla ("No system certificates available").
# En redes sin proxy (GitHub Actions) ambos pasos son inocuos.
FROM node:24-alpine AS certs

FROM postgres:16-bookworm

COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

RUN set -eux; \
    echo 'Acquire::https::CAInfo "/etc/ssl/certs/ca-certificates.crt";' > /etc/apt/apt.conf.d/99-ca; \
    sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
    sed -i 's|http://apt.postgresql.org|https://apt.postgresql.org|g' /etc/apt/sources.list.d/pgdg.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends postgresql-16-pgaudit; \
    rm -rf /var/lib/apt/lists/*

USER postgres

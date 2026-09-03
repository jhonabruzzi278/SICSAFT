# Build multi-stage — SPA estatica (Vite/React), a diferencia de cis/core (Nest de larga
# duracion): el runtime final es nginx sirviendo archivos, sin proceso Node corriendo. Ver
# devops/README.md para la topologia completa (Traefik + este contenedor + los demas niveles).

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .

# Variables VITE_* publicas (SPA sin secreto de cliente, ver src/lib/oidc/pkce.ts) — Vite las
# incrusta en el bundle en build time, no en runtime, asi que tienen que llegar como build args
# (ver devops/local/docker-compose.yml, servicio `web`) y no como ENV del contenedor final.
ARG VITE_KEYCLOAK_ISSUER
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_CIS_URL
# Nivel de producto contratado (DOC-029 RF-A): en `1` oculta el modulo Dashboard/indicadores
# (CIP); en `2` lo muestra. Unica diferencia CCP entre Nivel 1 y Nivel 2 (el resto va completo en
# ambos). Sin este arg, nivel.ts se cae a `2` (deploy standalone / `npm run dev`).
ARG VITE_SICSAFT_NIVEL=2
ENV VITE_KEYCLOAK_ISSUER=${VITE_KEYCLOAK_ISSUER} \
    VITE_KEYCLOAK_CLIENT_ID=${VITE_KEYCLOAK_CLIENT_ID} \
    VITE_CIS_URL=${VITE_CIS_URL} \
    VITE_SICSAFT_NIVEL=${VITE_SICSAFT_NIVEL}
RUN npm run build

# Imagen "unprivileged" — corre como usuario sin privilegios y escucha en 8080 por default (no
# 80, que requeriria root), mismo criterio de cis/Dockerfile ("nunca root en el contenedor
# final") sin tener que armar el usuario a mano como alli.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

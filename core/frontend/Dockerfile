# Build multi-stage — SPA estatica (Vite/React), a diferencia del backend de CORE (Nest de larga
# duracion, ver ../Dockerfile): el runtime final es nginx sirviendo archivos, sin proceso Node
# corriendo. Le habla a CIS, nunca al backend de CORE directo (ADR-003) — por eso este Dockerfile
# vive junto al de CORE pero no comparte ninguna capa con el.

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .

# Variables VITE_* publicas (SPA sin secreto de cliente, ver src/lib/oidc/pkce.ts) — Vite las
# incrusta en el bundle en build time, no en runtime, asi que tienen que llegar como build args
# (ver devops/local/docker-compose.yml, servicio `core-frontend`) y no como ENV del contenedor
# final.
ARG VITE_KEYCLOAK_ISSUER
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_CIS_URL
ENV VITE_KEYCLOAK_ISSUER=${VITE_KEYCLOAK_ISSUER} \
    VITE_KEYCLOAK_CLIENT_ID=${VITE_KEYCLOAK_CLIENT_ID} \
    VITE_CIS_URL=${VITE_CIS_URL}
RUN npm run build

# Imagen "unprivileged" — corre como usuario sin privilegios y escucha en 8080 por default (no
# 80, que requeriria root), mismo criterio que ccp/Dockerfile.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

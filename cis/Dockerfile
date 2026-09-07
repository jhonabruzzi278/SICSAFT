# Build multi-stage — ver devops/README.md para la topologia completa (Traefik + este contenedor
# + los demas niveles) y ADR-001 para el porque de NestJS.

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
# Reinstala solo dependencias de produccion en un directorio aparte, sin devDependencies,
# para copiar al stage final (mas liviano que "npm prune").
RUN bun install --production --frozen-lockfile

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Usuario sin privilegios — nunca correr el proceso como root en el contenedor final.
RUN addgroup -S sicsaft && adduser -S cis -G sicsaft
USER cis

COPY --from=build --chown=cis:sicsaft /app/dist ./dist
COPY --from=build --chown=cis:sicsaft /app/node_modules ./node_modules
COPY --from=build --chown=cis:sicsaft /app/package.json ./package.json

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]

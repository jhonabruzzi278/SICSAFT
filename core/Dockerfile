# Build multi-stage — ver devops/README.md para la topologia completa (Traefik + CIS + CORE
# + los demas niveles) y ADR-001 para el porque de NestJS.

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
# Reinstala solo dependencias de produccion en un directorio aparte, sin devDependencies,
# para copiar al stage final (mas liviano que "npm prune").
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Usuario sin privilegios — nunca correr el proceso como root en el contenedor final.
RUN addgroup -S sicsaft && adduser -S core -G sicsaft
USER core

COPY --from=build --chown=core:sicsaft /app/dist ./dist
COPY --from=build --chown=core:sicsaft /app/node_modules ./node_modules
COPY --from=build --chown=core:sicsaft /app/package.json ./package.json
# migrations/ y scripts/ viajan sin compilar: node-pg-migrate transpila los .ts al vuelo via
# jiti (dependencia productiva, sobrevive el --omit=dev del stage "build") — ver
# scripts/migrate.js. Permite correr `node scripts/migrate.js up` en esta misma imagen sin
# devDependencies, como hace el servicio `core-migrate` de devops/local/docker-compose.yml.
# migrations/ NO participa del build de Nest (ver tsconfig.build.json) para no romper la
# estructura plana de dist/ (dist/main.js) — se interpreta solo en runtime, vía jiti.
COPY --from=build --chown=core:sicsaft /app/migrations ./migrations
COPY --from=build --chown=core:sicsaft /app/scripts ./scripts
# src/ tambien viaja sin compilar: la migracion de seed importa contrato.seed.ts directo desde
# acá (ver migrations/1755000000001_seed-dev-fixture.ts) para que el caso DUOC UC/Melipilla
# tenga una unica fuente real en vez de retipearse en la migracion.
COPY --from=build --chown=core:sicsaft /app/src ./src

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]

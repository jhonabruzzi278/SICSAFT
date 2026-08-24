# Build multi-stage — mismo patron que core/Dockerfile (ver devops/README.md y ADR-001).

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S sicsaft && adduser -S cip -G sicsaft
USER cip

COPY --from=build --chown=cip:sicsaft /app/dist ./dist
COPY --from=build --chown=cip:sicsaft /app/node_modules ./node_modules
COPY --from=build --chown=cip:sicsaft /app/package.json ./package.json
# migrations/ y scripts/ viajan sin compilar — mismo motivo que core/Dockerfile: node-pg-migrate
# transpila los .ts al vuelo via jiti, permite `node scripts/migrate.js up` sin devDependencies.
COPY --from=build --chown=cip:sicsaft /app/migrations ./migrations
COPY --from=build --chown=cip:sicsaft /app/scripts ./scripts

EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]

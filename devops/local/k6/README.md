# Pruebas de carga (k6) — stack local

Prueba rápida de cómo aguantan `cis`, `core` y `cip` bajo carga, contra el stack local
(`devops/local`), visualizada en el Grafana que ya corre ahí. No es el entregable formal de
Fase 5 / OPS-5 (`ROADMAP.md`) — ese corre en cron contra staging, algo que todavía no existe en
este repo (solo `devops/local/` y `devops/prod/`). Esto es para responder "¿cómo se comporta
hoy?" mientras se desarrolla, no una automatización de CI.

## Por qué corre dentro de Docker, no `k6` instalado en el host

`core` y `cip` no publican puerto al host a propósito (`docker-compose.yml` — solo los consume
`cis`/otros servicios dentro de la red). El servicio `k6` de `docker-compose.yml` corre en la
misma red `sicsaft` y los resuelve por nombre de servicio (`http://core:3001`, `http://cip:3002`).

## Cómo correr

```bash
cd devops/local
docker compose up -d                      # el stack normal tiene que estar arriba
docker compose --profile k6 run --rm k6 run /scripts/smoke/health.js
docker compose --profile k6 run --rm k6 run /scripts/load/core-catalogo.js -o experimental-prometheus-rw
docker compose --profile k6 run --rm k6 run /scripts/load/cip-dashboard.js -o experimental-prometheus-rw
docker compose --profile k6 run --rm k6 run /scripts/stress/ramp-core-catalogo.js -o experimental-prometheus-rw
```

`--profile k6` es necesario siempre — sin eso, `docker compose` ignora el servicio `k6` (a
propósito: nunca debe arrancar con un `docker compose up -d` normal). El flag
`-o experimental-prometheus-rw` es el que empuja las métricas a Prometheus; sin él, el resultado
solo se ve en la consola al terminar el test.

## Ver los resultados en Grafana

1. `http://grafana.sicsaft.localhost` (mismas credenciales que el resto de la observabilidad
   local, ver `../README.md`).
2. Dashboards → New → Import → pegar el id **`18030`** (["k6 Prometheus (Native
   Histograms)"](https://grafana.com/grafana/dashboards/18030-k6-prometheus-native-histograms/),
   el dashboard oficial de los mantenedores de k6) → datasource Prometheus ya provisionado.
   Mismo criterio que "Node Exporter Full" (id `1860`, ver `../README.md` Observabilidad):
   dashboards de la comunidad se importan desde la UI, no se versionan acá.

## Qué queda fuera de esta primera pasada

- **Endpoints protegidos de CIS** (`/catalogo` vía CIS, `/inventarios`, etc.): CIS valida JWT real
  de Zitadel (OIDC/PKCE), no el header de servicio simple que usan CORE/CIP — no hay forma de
  scriptear ese login sin un flujo de token aparte (ROPC no está habilitado en las apps OIDC
  existentes, todas son "User Agent" SPA/PKCE). Por ahora `smoke/health.js` cubre `cis/health`
  (sin auth) — si hace falta cargar el camino completo `CIS → CORE`, el siguiente paso es generar
  un token de un usuario de prueba una vez y pasarlo como `-e CIS_TOKEN=...` a un script nuevo.
- **Fase 5 / OPS-5 formal**: cron programado, ambiente de staging, documentación AI-DLC — todo
  eso queda pendiente de una decisión aparte (no hay staging todavía, ver arriba).

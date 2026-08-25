# Requisitos — Instalador on-premise por cliente

Ver `../requirements/INTENT.md` para el contexto completo. IDs nuevos, prefijo `INST-` para no
colisionar con los RF/RNF ya numerados de otros sistemas (ver `REQUISITOS.md` raíz).

## Funcionales

- **INST-RF-01**: El stack debe poder levantarse en modo Nivel 1 (Postgres, Redis, Zitadel, CIS,
  CORE, APP QR SICSAFT servida localmente) sin ningún servicio de portal web.
- **INST-RF-02**: El stack debe poder levantarse en modo Nivel 2 (Nivel 1 + `ccp` + `web-admin` +
  `core-frontend`) desde el mismo `docker-compose.yml`, vía Compose profiles — sin mantener
  archivos compose separados por nivel.
- **INST-RF-03**: Un script (`bootstrap-zitadel.ps1`) debe crear, contra un Zitadel recién
  levantado y vacío, la organización del cliente, el proyecto "CIS", los roles de Proyecto
  necesarios según el nivel (`administrador-patrimonial` siempre; `directivo` y
  `administrador-sistema` solo si Nivel 2), y las apps OIDC (APP QR siempre; `ccp`/`web-admin`/
  `core-frontend` solo si Nivel 2) con Auth Token Type JWT, Role Assertion y grant
  `refresh_token` — sin pasos manuales en el dashboard de Zitadel.
- **INST-RF-04**: El script de bootstrap debe ser idempotente o fallar de forma clara si se corre
  dos veces contra la misma organización (no debe crear duplicados silenciosos).
- **INST-RF-05**: `app-qr-sicsaft` necesita su propio `Dockerfile` (no existe hoy — hoy se
  despliega en Vercel) para poder servirse dentro del stack onprem, mismo patrón que
  `ccp/Dockerfile` (build Vite + nginx unprivileged).
- **INST-RF-06**: El `.env.example` de `devops/onprem/` debe incluir solo las variables que
  aplican a una instalación de cliente (sin `GRAFANA_*`, `METRICS_TOKEN`, ni nada de
  observabilidad/k6 — eso es herramienta del admin, no del cliente).

## No funcionales

- **INST-RNF-01**: El stack debe correr sobre **Podman + podman-compose** en Windows 10/11, no
  sobre Docker Desktop — decisión confirmada con el usuario (menor consumo de recursos en reposo,
  sin licenciamiento comercial de Docker Desktop). Los mismos `Dockerfile`s del repo deben
  funcionar sin cambios; el `docker-compose.yml` de `devops/onprem/` se valida específicamente
  contra `podman-compose`, no se asume compatibilidad 1:1 con Docker Compose.
- **INST-RNF-02**: Ningún servicio de observabilidad/desarrollo (Prometheus, Loki, Grafana,
  cAdvisor, node-exporter, k6, dashboard de Traefik) se instala en el PC del cliente.
- **INST-RNF-03**: Las credenciales generadas para un cliente (Postgres, Redis, Zitadel
  masterkey, `ZITADEL_ADMIN_TOKEN`) deben ser únicas por instalación — nunca reusar valores entre
  clientes distintos.
- **INST-RNF-04**: El README de `devops/onprem/` debe dejar explícito el orden obligatorio
  bootstrap-antes-de-build (los frontends hornean `VITE_ZITADEL_CLIENT_ID` en build time) para
  evitar reconstrucciones innecesarias de imágenes.

## Preguntas abiertas (no bloquean este incremento, se documentan)

- **INST-Q-01**: ¿`cip/` (BI) entra en algún nivel de producto? El usuario no lo mencionó en los 3
  niveles de precios — queda fuera hasta que se decida explícitamente.
- **INST-Q-02**: Gestión de secretos multi-cliente (dónde guarda el admin el
  `ZITADEL_ADMIN_TOKEN` de cada cliente instalado) — decisión operativa del admin, fuera del
  alcance de este repo, pero se deja registrada como necesidad real.
- **INST-Q-03**: Licenciamiento/activación por nivel — explícitamente fuera de esta fase (ver
  INTENT.md), pero se deja como pregunta para una fase de negocio futura.

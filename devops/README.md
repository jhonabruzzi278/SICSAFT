# Infraestructura / DevOps / Observabilidad SICSAFT (capacidad transversal — OPS)

## Objetivo
Capacidad transversal de infraestructura, CI/CD, seguridad operacional y observabilidad para
todos los sistemas del ecosistema (APP QR, CIS, CORE, WEB, CIP, RFID, Integraciones).

## Estado
🟡 Stack local funcionando (`devops/local/`: Traefik + Postgres + Redis + Zitadel + los 5 sistemas
+ observabilidad self-hosted en Docker Compose, ver su README para cómo levantarlo). Observabilidad
(2026-08-19): Prometheus (métricas de host y contenedores) + Loki/Promtail (logs de todos los
contenedores) + Grafana (dashboards provisionados solos) — equivalente self-hosted a
CloudWatch/CloudTrail, administrado por el operador del VPS, ver `devops/local/README.md`
"Observabilidad". [`devops/prod/docker-compose.yml`](prod/docker-compose.yml) (2026-08-20) — stack
de producción listo para desplegarse como recurso "Docker Compose" en **Coolify** sobre el VPS
propio (sin `traefik` propio, Coolify trae el suyo; ver `devops/prod/README.md` "Despliegue con
Coolify"). Gestión de secretos de producción **revisada** (2026-08-20): variables nativas del
panel de Coolify en vez de SOPS + age (ver `devops/prod/README.md` "Decisión revisada" para el
porqué) — herramientas SOPS+age quedan documentadas como histórico, no como flujo activo. Falta el
VPS real (dominios `sicsaft.cl` sin comprar/apuntar todavía, ni instancia de Coolify corriendo) —
ver [ADR-001](../adr/ADR-001-stack-backend-nestjs.md) y
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) para el stack ya decidido.

## Modelo de despliegue: VPS propio, Docker Compose orquestado por Coolify
El usuario administra su propio VPS (no una plataforma gestionada tipo Vercel/Render para
backend). Cada nivel del ecosistema es su propio contenedor con su propio `Dockerfile`
multi-stage, orquestados por Docker Compose — consistente con "cada nivel = un repositorio o
paquete desplegable propio" de [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 1. **Coolify**
(self-hosted, en el mismo VPS) es el panel que orquesta ese Docker Compose y provee el proxy
reverso/TLS — no es un PaaS gestionado de terceros, sigue siendo el mismo VPS propio (decisión
2026-08-20, ver `devops/prod/README.md` "Decisión revisada").

Árbol real (ya existe, ya no es solo el plan):

```
devops/
├── local/                          # stack de desarrollo — ver devops/local/README.md
│   ├── docker-compose.yml
│   ├── traefik/                    # Traefik propio, solo para local (Coolify trae el suyo)
│   ├── observability/              # config compartida de Prometheus/Loki/Promtail/Grafana
│   └── postgres/init/              # scripts de bootstrap de roles/bases, compartidos con prod
└── prod/                           # stack de producción — ver devops/prod/README.md
    ├── docker-compose.yml          # recurso "Docker Compose" en Coolify, sin traefik propio
    ├── .env.example                # variables a cargar en el panel de Coolify (sin valores reales)
    └── README.md                   # despliegue + histórico de la decisión SOPS+age
```

Cada sistema (`cis/Dockerfile`, `core/Dockerfile`, `ccp/Dockerfile`, ...) vive en su propia
carpeta de nivel raíz, no dentro de `devops/` — `devops/prod/docker-compose.yml` los referencia
por `build.context` relativo (ver ese archivo).

- **Coolify** (proxy Traefik propio) como único punto de entrada (80/443) en producción, enruta
  por dominio asignado desde su panel ("Domains" por servicio) y renueva TLS solo (Let's
  Encrypt) — en local sigue siendo un Traefik propio con config estática (ver
  `devops/local/traefik/dynamic.yml`), porque ahí no hay Coolify.
- Red Docker interna aislada por ambiente (`sicsaft` en ambos compose, redes Docker distintas por
  ser stacks/proyectos distintos); solo el proxy expone puertos al host.
- Backups automatizados con destino externo al VPS (si el VPS se cae o se compromete, el backup
  no puede vivir en el mismo disco) — pendiente, ver "Próximo paso sugerido".

## Dominios (bajo `sicsaft.cl`, `sicsaft.com` solo como redirect de protección de marca)

| Subdominio | Sistema |
|---|---|
| `sicsaft.cl` | Landing comercial (público, sin login) |
| `id.sicsaft.cl` | Identidad/SSO — Zitadel (ver ADR-002) |
| `api.sicsaft.cl` | CIS (API Gateway) |
| `app.sicsaft.cl` | CCP — Centro de Control Patrimonial (hub post-login del Profesional de AFT) |
| `admin.sicsaft.cl` | web_admin — Portal WEB del Administrador del Sistema (DOC-022) |
| `directivo.sicsaft.cl` | core/frontend — Portal WEB del Directivo (DOC-022, ADR-003) |
| `grafana.sicsaft.cl` | Grafana — dashboards de observabilidad (acceso solo con login, ver "Observabilidad self-hosted" abajo) |
| `qr.sicsaft.cl` | APP QR SICSAFT (PWA instalable, subdominio propio por `scope` del manifest) |
| `cip.sicsaft.cl` | CIP (dashboards/BI), separable de `app.` si el tráfico lo justifica |

Las filas `admin.`/`directivo.`/`grafana.` se agregaron acá (2026-08-20) siguiendo el mismo patrón
de nombre corto por rol/propósito que ya usa esta tabla — mismo criterio que los hostnames locales
`admin.sicsaft.localhost`/`directivo.sicsaft.localhost` de `devops/local/docker-compose.yml`, no
una decisión nueva de naming.

## Rama `main` — regla no negociable
**Nunca push directo a `main`**, configurado como branch protection en GitHub desde ya, aunque el
deploy automático al VPS todavía no exista:
- Push directo a `main` bloqueado.
- PR obligatorio, CI en verde obligatorio, al menos 1 review (self-review con checklist mientras
  el equipo es de una persona, pero el gate de PR igual bloquea un push directo por accidente).
- `main` es siempre lo único desplegable. Ramas de trabajo cortas (`feat/…`, `fix/…`).

## Pipeline CI/CD (GitHub Actions)

```
lint + type-check
  → unit tests
    → integration tests (Testcontainers: Postgres/Redis reales en contenedor, no mocks)
      → SAST (Semgrep) + secret scan (gitleaks) + dependency scan (npm audit / Trivy)
        → build de imagen Docker (multi-stage)
          → scan de imagen (Trivy)
            → push a registry (GHCR)
              → deploy automático a staging (webhook de Coolify sobre push a la rama de staging)
                → smoke tests contra staging
                  → aprobación manual → deploy a producción (Coolify, mismo mecanismo)
```

El paso de deploy cambió de "SSH + `docker compose pull && up -d`" (plan original) a **Coolify
redesplegando su recurso Docker Compose** vía webhook — ver `devops/prod/README.md` "Despliegue
con Coolify". Las etapas anteriores (lint → tests → scans → build/push de imagen) no cambian,
Coolify solo reemplaza el último tramo (SSH manual) por su propio mecanismo de redeploy.

Carga/estrés (k6) corre en cron contra staging (ej. nocturno), no en cada PR — es lento y caro
para el ciclo de feedback normal.

## Estrategia de testing
- Pirámide: unit → **integración con Testcontainers** (servicios reales, no mocks) → contract
  tests CIS↔CORE (evita que un cambio en un nivel rompa al otro sin que el CI se entere) → e2e
  (Playwright, ya en uso en APP QR) → carga/estrés (k6, en cron).
- Cobertura de líneas alta (90–100%) como piso, complementada con **mutation testing (Stryker)**
  como gate real de calidad — cobertura de líneas sola es gameable (mide si el test tocó la línea,
  no si detectaría un bug ahí). Empezar con umbral de mutation score bajo (~60%) y subirlo con el
  tiempo es más realista que exigir 100% en ambos ejes desde el primer commit.
- Ningún PR mergea si baja del umbral de cobertura o de mutation score configurado en CI.

## Cyberseguridad del VPS
- Solo 80/443 públicos; SSH por clave únicamente, IP allowlist o VPN (Tailscale/WireGuard) para
  administración.
- `ufw` + `fail2ban`, actualizaciones de SO automáticas (`unattended-upgrades`).
- Secretos fuera de git en texto plano: **SOPS + age** (decisión cerrada, ver
  [`devops/prod/README.md`](prod/README.md) para el flujo completo y por qué no un gestor
  dedicado) — el archivo cifrado sí se commitea, la clave privada nunca. Nunca hardcodeados (ya
  reforzado en el `.gitignore` raíz).
- Observabilidad self-hosted: Prometheus + Grafana + Loki + Alertmanager — mismas "tres señales"
  de [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 2 (métricas, logs estructurados con
  `correlationId`, trazas).
- Rate limiting y WAF a nivel de Traefik (Coraza/ModSecurity), o Cloudflare delante del VPS.

## Cumplimiento legal (diferenciador de venta)
- Chile: Ley 19.628 vigente hoy + **Ley 21.719** (nueva ley de protección de datos personales,
  entra en vigencia ~diciembre 2026) — diseñar el modelo de datos de usuarios/operadores ya
  contemplando derechos ARCO, registro de tratamiento y notificación de brechas, antes de que la
  ley entre en vigencia.
- El Motor de Auditoría del Tomo IV (usuario/fecha/hora/operación/resultado/IP) ya cubre buena
  parte de la trazabilidad que exige cumplimiento normativo típico — no perderlo de vista al
  implementar.
- Alinear controles internos a ISO 27001/NIST CSF como checklist (sin certificar aún) es un
  argumento de venta B2B sin el costo de la certificación completa.

## Depende de
Ninguna dependencia dura restante — [ADR-001](../adr/ADR-001-stack-backend-nestjs.md) y
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) ya destraban el diseño de pipelines
concretos.

## Bloquea
Nada de forma dura, pero sin esto no hay entorno productivo real para ningún sistema más allá de
APP QR (hoy en Vercel).

## Documentos relacionados
[ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) — pilar de Excelencia Operacional (2) y de
Seguridad (3). [ADR-001](../adr/ADR-001-stack-backend-nestjs.md) (stack).
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (identidad/SSO/dominios).
[`devops/prod/README.md`](prod/README.md) (gestión de secretos, SOPS + age).

## Próximo paso sugerido
Comprar el VPS, instalar Coolify, y desplegar `devops/prod/docker-compose.yml` como primer
entregable (ver `devops/prod/README.md` "Despliegue con Coolify") — permite validar
dominios/TLS/SSO de punta a punta contra el stack real antes de preocuparse por backups o el resto
del pipeline de CI/CD. Tarjeta Trello: `OPS-ADR-002`.

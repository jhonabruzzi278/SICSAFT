# Infraestructura / DevOps / Observabilidad SICSAFT (capacidad transversal — OPS)

## Objetivo
Capacidad transversal de infraestructura, CI/CD, seguridad operacional y observabilidad para
todos los sistemas del ecosistema (APP QR, CIS, CORE, WEB, CIP, RFID, Integraciones).

## Estado
🟡 Diseño definido, sin implementar. Stack de aplicación decidido — ver
[ADR-001](../adr/ADR-001-stack-backend-nestjs.md) y [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md).

## Modelo de despliegue: VPS propio, Docker Compose
El usuario administra su propio VPS (no una plataforma gestionada tipo Vercel/Render para
backend). Cada nivel del ecosistema es su propio contenedor con su propio `Dockerfile`
multi-stage, orquestados por Docker Compose — consistente con "cada nivel = un repositorio o
paquete desplegable propio" de [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §1.

```
sicsaft-vps/
├── docker-compose.yml              # servicios base: traefik, postgres, redis, zitadel
├── docker-compose.staging.yml      # overrides por ambiente
├── docker-compose.prod.yml
├── traefik/                        # reverse proxy + TLS automático (Let's Encrypt)
├── cis/Dockerfile
├── core/Dockerfile
├── web/Dockerfile
└── backups/                        # restic/borgbackup, destino EXTERNO al VPS
```

- **Traefik** como único punto de entrada (80/443), enruta por subdominio y renueva TLS solo.
- Red Docker interna aislada por ambiente; solo Traefik expone puertos al host.
- Backups automatizados con destino externo al VPS (si el VPS se cae o se compromete, el backup
  no puede vivir en el mismo disco).

## Dominios (bajo `sicsaft.cl`, `sicsaft.com` solo como redirect de protección de marca)

| Subdominio | Sistema |
|---|---|
| `sicsaft.cl` | Landing comercial (público, sin login) |
| `id.sicsaft.cl` | Identidad/SSO — Zitadel (ver ADR-002) |
| `api.sicsaft.cl` | CIS (API Gateway) |
| `app.sicsaft.cl` | Portal WEB (hub post-login) |
| `qr.sicsaft.cl` | APP QR SICSAFT (PWA instalable, subdominio propio por `scope` del manifest) |
| `cip.sicsaft.cl` | CIP (dashboards/BI), separable de `app.` si el tráfico lo justifica |

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
              → deploy automático a staging (SSH + `docker compose pull && up -d`)
                → smoke tests contra staging
                  → aprobación manual → deploy a producción
```

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
- Secretos fuera de git: SOPS + age (cifrado, versionable) o un gestor de secretos dedicado —
  nunca hardcodeados (ya reforzado en el `.gitignore` raíz).
- Observabilidad self-hosted: Prometheus + Grafana + Loki + Alertmanager — mismas "tres señales"
  de [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §2 (métricas, logs estructurados con
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
[ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) — pilar de Excelencia Operacional (§2) y de
Seguridad (§3). [ADR-001](../adr/ADR-001-stack-backend-nestjs.md) (stack).
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (identidad/SSO/dominios).

## Próximo paso sugerido
Levantar el `docker-compose.yml` base (Traefik + Postgres + Redis + Zitadel) en el VPS como
primer entregable, antes de tener CIS/CORE con código — permite validar dominios/TLS/SSO de punta
a punta con servicios vacíos. Tarjeta Trello: `OPS-ADR-002`.

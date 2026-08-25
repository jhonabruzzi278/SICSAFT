# Arquitectura — Instalador on-premise por cliente

Ver `../requirements/INTENT.md` y `../requirements/REQUIREMENTS.md` para el contexto y los
requisitos completos. Este documento cubre cómo `devops/onprem/` deriva de `devops/local/`, qué
entra en cada nivel, y el flujo del bootstrap de Zitadel.

## De dónde parte

`devops/onprem/` es una tercera carpeta hermana de `devops/local/` (dev) y `devops/prod/`
(VPS/Coolify) — mismo patrón documentado en `devops/README.md` "Árbol real". Parte de
`devops/local/docker-compose.yml` porque ya es, en los hechos, un tenant aislado (un Postgres, un
Zitadel, sin infraestructura multi-cliente real) — más cercano a lo que necesita una instalación
de cliente que `devops/prod/` (pensado para Linux/Coolify, no para un PC Windows).

## Diferencias contra `devops/local/`

```mermaid
flowchart TB
    subgraph local["devops/local/ (desarrollador)"]
        L1[traefik + dashboard]
        L2[postgres + redis + zitadel]
        L3[cis + core + cip]
        L4[ccp + web-admin + core-frontend]
        L5[Prometheus + Loki + Grafana + cAdvisor + node-exporter]
        L6[k6]
    end

    subgraph onprem["devops/onprem/ (cliente, Nivel 1/2)"]
        O1[traefik, ruteo estático — sin dashboard expuesto]
        O2[postgres + redis + zitadel]
        O3[cis + core]
        O4["app-qr-sicsaft (nuevo Dockerfile)"]
        O5["ccp + web-admin + core-frontend — solo perfil nivel2"]
    end

    local -. "subconjunto, no copia" .-> onprem
```

- **Sin observabilidad** (Prometheus/Loki/Grafana/cAdvisor/node-exporter) ni `k6`: herramienta del
  admin/desarrollador, no del cliente final. No se instala en el PC del cliente (INST-RNF-02).
- **Sin dashboard de Traefik expuesto** (`--api.insecure=true` de `devops/local/` queda fuera):
  riesgo innecesario en el PC del cliente.
- **`cip` fuera de los 3 niveles**: no mencionado por el usuario en el modelo de precios — pregunta
  abierta (INST-Q-01), no se instala hasta que se decida.
- **`app-qr-sicsaft` necesita `Dockerfile` propio**: hoy se despliega en Vercel (`README.md`
  "Dónde está el trabajo activo hoy"), no tiene contenedor — se agrega uno nuevo, mismo patrón que
  `ccp/Dockerfile` (build Vite multi-stage + `nginx-unprivileged` sirviendo el bundle, puerto
  8080).
- **Runtime de contenedores: Podman, no Docker Desktop** — ver "Runtime: Podman" abajo.

## Niveles de producto → servicios (resumen, detalle formal en DOC-025)

| Nivel | Servicios que se levantan |
|---|---|
| Nivel 1 | `postgres`, `redis`, `zitadel`, `core-migrate`→`core`, `cis`, `app-qr-sicsaft` |
| Nivel 2 | Nivel 1 + `ccp` + `web-admin` + `core-frontend` |
| Nivel 3 | Nivel 2 + RFID — **no implementado, `rfid/` no tiene código todavía** |

Implementado con **Compose profiles** (`nivel1`, `nivel2`) en un solo `docker-compose.yml` — mismo
mecanismo que ya usa `devops/local/docker-compose.yml` para aislar el servicio `k6`
(`profiles: ["k6"]`). Los servicios base (postgres/redis/zitadel/cis/core/app-qr-sicsaft) no
llevan profile (siempre se levantan); `ccp`/`web-admin`/`core-frontend` llevan `profiles:
["nivel2"]`.

## Runtime: Podman, no Docker Desktop

Decisión confirmada con el usuario: Docker Desktop tiene overhead real en el PC del cliente (VM
Hyper-V/WSL2 + GUI + licenciamiento comercial por tamaño de empresa). En su lugar:

- **Podman** (rootless, sin daemon persistente con GUI) + **podman-compose** — compatible con los
  mismos `Dockerfile`s y prácticamente el mismo `docker-compose.yml` que ya existen en el repo.
- Sigue apoyándose en una máquina WSL2 propia (`podman machine init && podman machine start`) —
  WSL2 no desaparece, pero sí el daemon Docker Desktop con GUI.
- **Riesgo a verificar, no asumido**: los `healthcheck` + `depends_on: condition:
  service_healthy` que el compose actual usa fuerte (`core-migrate` → `core`, `postgres`/`redis`
  healthy antes de levantar `cis`/`core`) deben comportarse igual bajo `podman-compose` — se
  verifica al implementar `devops/onprem/docker-compose.yml`, no se da por hecho que la paridad
  con Docker Compose es 100%.
- Como Podman no tiene Enhanced Container Isolation (limitación específica de Docker Desktop en
  Windows), el problema documentado en `devops/local/README.md` ("Nota sobre el ruteo de Traefik
  en Windows") sobre el provider `docker` de Traefik podría no aplicar — igual se mantiene el
  provider `file` (ruteo estático) por simplicidad y paridad con `devops/local/`, no por esa
  restricción puntual.

## Flujo del bootstrap de Zitadel

```mermaid
sequenceDiagram
    participant Admin
    participant Zitadel
    participant Env as .env del cliente

    Admin->>Zitadel: podman-compose up postgres redis zitadel
    Admin->>Zitadel: bootstrap-zitadel.ps1 (Management API)
    Zitadel-->>Admin: Organización creada
    Zitadel-->>Admin: Proyecto "CIS" + roles creados
    Zitadel-->>Admin: Apps OIDC creadas (Client IDs)
    Admin->>Env: completar VITE_ZITADEL_CLIENT_ID por app
    Admin->>Zitadel: podman-compose --profile nivelX up -d --build
    Note over Admin,Zitadel: build de frontends recién acá — ya tienen<br/>los Client IDs reales para hornear en Vite
```

`bootstrap-zitadel.ps1` reusa el mismo patrón de cliente HTTP contra la Management API de Zitadel
que ya existe en `cis/src/zitadel-admin/zitadel-admin.service.ts` (service user + Personal Access
Token) — no se reinventa la integración, se adapta a un script standalone porque corre antes de
que `cis` exista (el bootstrap es anterior al `up` completo del stack).

## Qué NO cambia

- El esquema de base de datos (`core/migrations/`, `cip/migrations/`), los `Dockerfile`s de cada
  sistema, y la lógica de `core-migrate`/`cip-migrate` se reusan tal cual — este incremento es
  puramente de topología de despliegue, no de dominio.
- `devops/local/` y `devops/prod/` no se tocan — `devops/onprem/` es un tercer objetivo de
  despliegue, no un reemplazo.

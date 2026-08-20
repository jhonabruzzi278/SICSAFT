# SICSAFT — reglas del repo

Monorepo de varios sistemas independientes (no workspace/npm-workspaces): cada carpeta de nivel
raíz (`cis/`, `core/`, `ccp/`, `web_admin/`, ...) es su propio desplegable con su propio
`package.json`, `Dockerfile` y pipeline de CI. Ver [README.md](README.md) para el mapa completo de
sistemas y [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md) para el marco de arquitectura.

**Tres portales, tres roles, tres logins — nunca uno compartido** (DOC-022): `ccp/` (ex-`web/`) es
exclusivo del Profesional de AFT, `web_admin/` del Administrador del Sistema, y `core/frontend/`
del Directivo. `core/` es el único sistema con dos deployables (`core/` = backend NestJS,
`core/frontend/` = SPA) — el frontend le habla a CIS, nunca a CORE directo (ver
[ADR-003](adr/ADR-003-frontend-de-core-para-directivo.md)), así que la regla de abajo sigue
aplicando sin excepción.

## Arquitectura del ecosistema (flujo de datos)

```
Fuentes de captura (APP QR, WEB, RFID, ERP, ...)
        ↓
      CIS (interoperabilidad — cis/, NestJS)
        ↓
    SICSAFT CORE (orquestador + motores — core/, NestJS)
        ↓
  Base Patrimonial Central (fuente única de verdad — Postgres)
        ↓
      CIP (inteligencia / BI — cip/)
        ↓
  Usuarios / Organización (ccp/, web_admin/, core/frontend/)
```

- **`cis/`** — backend NestJS, único punto de entrada para fuentes de captura (proxy delgado hacia
  CORE, auth Zitadel, circuit breaker/reintentos/rate limiting). Nunca escribe directo a la Base
  Patrimonial.
- **`core/`** — backend NestJS, orquestador + motores (Patrimonial, Reglas, Eventos, Auditoría).
  Único sistema con dos deployables: el backend (`core/`) y su SPA (`core/frontend/`, portal del
  Directivo). El frontend habla con CIS, nunca directo al backend de CORE ([ADR-003](adr/ADR-003-frontend-de-core-para-directivo.md)).
- **`ccp/`, `web_admin/`, `core/frontend/`** — tres SPAs Vite/React independientes, un portal por
  rol (Profesional de AFT / Administrador del Sistema / Directivo), cada una con su propio login
  OIDC/PKCE contra Zitadel. No comparten sesión ni código entre sí.
- **`base-patrimonial/`** — modelo de dominio de la Base Patrimonial Central, documentado y
  versionado en `core/migrations/` (Postgres real).
- **`devops/local/docker-compose.yml`** — stack local completo: Traefik + Postgres + Redis +
  Zitadel + los 5 sistemas + observabilidad self-hosted (Prometheus + Loki/Promtail + Grafana,
  equivalente a CloudWatch/CloudTrail pero administrado por el operador del VPS).

Estado real y detalle de cada sistema (qué está mockeado vs. real, endpoints, dependencias): tabla
completa en [README.md](README.md) y el `README.md` propio de cada carpeta.

## Comandos por sistema

`cis/` y `core/` son NestJS (Jest); `ccp/`, `web_admin/`, `app-qr-sicsaft/` y `core/frontend/` son
Vite/React. `ccp/`, `web_admin/` y `core/frontend/` tienen ESLint + Vitest (unit) — `app-qr-sicsaft/`
todavía no tiene ninguno de los dos configurado. Playwright (e2e) existe en `ccp/` y
`app-qr-sicsaft/`; instalado pero sin specs en `web_admin/`; inexistente en `core/frontend/`. Cada
comando corre desde la carpeta del sistema.

**Backends (`cis/`, `core/`):**
```bash
npm run start:dev          # dev server con watch
npm run lint:ci             # eslint --max-warnings=0 (lo que corre CI; usar "lint" a secas para autofix local)
npm test                    # jest (unit)
npx jest ruta/al.spec.ts    # un solo archivo de test
npx jest -t "nombre del test"  # un solo test por nombre
npm run test:cov            # cobertura — umbral en package.json > jest.coverageThreshold (100% líneas/funciones en cis/ y core/)
npm run test:e2e            # jest contra ./test/jest-e2e.json (Postgres real en CI, no mocks)
npm run build                # nest build
```
`core/` además tiene `npm run migrate:up` / `migrate:down` (`node-pg-migrate` sobre
`core/migrations/`).

**Frontends, todas (`ccp/`, `web_admin/`, `app-qr-sicsaft/`, `core/frontend/`):**
```bash
npm run dev                  # vite
npm run build                 # tsc -b && vite build
```

**`ccp/`, `web_admin/`, `core/frontend/` además tienen:**
```bash
npm run lint:ci               # eslint --max-warnings=0 (mismo criterio que cis/core)
npm test                      # vitest run — hoy solo cubre src/lib/oidc/ (PKCE/tokens/refresh, DOC-023)
npm run test:cov              # vitest run --coverage
```

**`ccp/` y `app-qr-sicsaft/` además tienen e2e real** (`web_admin/` tiene Playwright instalado pero
sin specs todavía; `core/frontend/` no tiene e2e):
```bash
npm run test:e2e              # playwright test
npx playwright test archivo.spec.ts   # un solo archivo e2e
```

**Stack local completo** (Traefik + Postgres + Redis + Zitadel + los 5 sistemas + observabilidad
self-hosted — Prometheus/Loki/Grafana):
```bash
cd devops/local && docker compose up -d
```
Ver [`devops/local/README.md`](devops/local/README.md) para variables de entorno, dominios
locales, y la sección "Observabilidad" (URLs de Grafana, qué mide cada componente, limitación
conocida de cAdvisor en Docker Desktop).

No hay comando de build/test a nivel raíz del repo — cada sistema se construye y testea de forma
aislada dentro de su propia carpeta.

## Regla no negociable del ecosistema

**Ninguna fuente de captura (APP QR, WEB, RFID, ERP) puede modificar la Base Patrimonial Central
directamente.** Todo pasa por `CIS → CORE`. Esto viene de Tomo IV 1.7 y está grabado en el
diagrama de [README.md](README.md). Ningún cambio de código debe crear un atajo que la rompa
(ej. un servicio nuevo que le escriba a `base-patrimonial`/Postgres sin pasar por `core/`).

## Fuente de verdad de cada decisión

- **Qué debe hacer cada sistema y qué reglas de negocio cumple**: los tomos oficiales
  (`TOMO III Cap.1/4`, `TOMO IV Cap.1/2`), citados por sección (`x.y`) en cada README y en
  `base-patrimonial/DOC-004-modelo-contrato.md`. Si el código y un README citando un tomo
  entran en conflicto, el tomo gana — corregir el código o levantar la discrepancia, nunca
  editar la cita para que calce.
- **Cómo construir eso de forma escalable/resiliente**: [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md).
- **Decisiones de stack ya tomadas**: [`adr/`](adr) (NestJS, Postgres, Redis, Zitadel
  self-hosted). No reabrir estas decisiones sin un ADR nuevo que las reemplace explícitamente.
- **Qué puede hacer cada rol (RBAC), endpoint por endpoint**:
  [`ccp/DOC-023`](aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md) — matriz
  Rol × Módulo × Acción extraída de los guards reales de CIS/CORE, no de lo que la UI muestra
  u oculta. Antes de agregar un endpoint nuevo con autorización, revisar ahí qué patrón de guard
  ya existe para el caso (rol contra `organizacionId` puntual, rol en cualquier organización,
  o solo `ServiceTokenGuard`) en vez de inventar uno nuevo.
- **Estado real de cada sistema**: el README de esa carpeta, no memoria de conversaciones
  anteriores — los README se mantienen sincronizados con el código en cada commit relevante (ver
  "Documentación" abajo).

## Documentación

- Cada carpeta de sistema tiene su propio `README.md` con Objetivo / Estado / Depende de /
  Bloquea / Documentos relacionados / Próximo paso sugerido. Al terminar un cambio de código que
  altere el estado de un sistema (mock → real, endpoint nuevo, dependencia resuelta), actualizar
  ese README en el mismo commit o en uno inmediatamente siguiente — no dejar que quede
  desactualizado para la próxima sesión.
- Nunca describir algo como "mock" o "no implementado" si ya corre sobre datos reales, y
  viceversa — son afirmaciones que otras partes del repo citan y de las que dependen decisiones
  futuras.
- Al incorporar contenido nuevo de un tomo oficial (`.doc` fuente, no versionado en git), citar
  la sección exacta (`Tomo III 1.4`, no solo "el tomo dice") y anotar explícitamente si lo que
  describe ya está implementado o sigue pendiente.

## Metodología AI-DLC para features nuevas

Toda fase de trabajo no trivial (una fase de `ROADMAP.md`, una feature nueva) se documenta con
AI-DLC **antes** de escribir código. Toda la documentación AI-DLC de todos los sistemas vive en
una única carpeta en la raíz del proyecto, `aidlc-docs/`, con una subcarpeta por sistema —
**nunca anidada dentro del sistema que la implementa**. Se decidió así (2026-08-20) porque cada
carpeta de sistema es su propio desplegable (ver arriba) y `aidlc-docs/` es documentación de
proceso, no código ni artefacto de build — mezclarla dentro de `cis/`, `core/`, etc. la hacía
difícil de descubrir y la exponía a quedar arrastrada por accidente en un build o un
`Dockerfile` mal filtrado. Estructura estándar, un directorio por sistema (`app-qr-sicsaft/`,
`ccp/`, `cip/`, `core/`, y el que corresponda a cada sistema nuevo):

```
aidlc-docs/
└── <sistema>/
    ├── 00_PROJECT_METADATA.md      # estado de fase (Inception/Construction/Operations), quick links
    ├── requirements/
    │   ├── INTENT.md                # que se pidio, por que ahora, que NO es esta fase
    │   └── REQUIREMENTS.md          # funcionales/no funcionales, con ID (RF-XX/RNF-XX) y fuente
    ├── story-artifacts/
    │   └── USER_STORIES.md          # desde la perspectiva del consumidor real, con criterios de aceptacion
    ├── design-artifacts/
    │   ├── DOMAIN_MODEL.md          # entidades + diagramas (mermaid erDiagram/stateDiagram)
    │   ├── ARCHITECTURE.md          # mapa de modulos + diagramas de secuencia
    │   └── DOC-XXX-*.md             # contratos/documentos numerados, mismo esquema que DOC-002/004/005
    └── testing/
        └── TEST_STRATEGY.md         # que se testea y como, sin bajar el umbral de cobertura vigente
```

- **Ruta canónica**: `aidlc-docs/<sistema>/...` — nunca `<sistema>/aidlc-docs/...`. Al enlazar
  desde el README de un sistema (que sí vive dentro de `<sistema>/`) hacia su propia
  documentación AI-DLC, la ruta relativa sube un nivel primero: `../aidlc-docs/<sistema>/...`.
- **Diseño antes que código**: cuando el usuario pide explícitamente diseñar primero, generar
  todo `aidlc-docs/<sistema>/` de la fase, presentarlo, y esperar confirmación antes de tocar
  `src/`.
- **Diagramas en Mermaid** (`erDiagram`, `stateDiagram-v2`, `sequenceDiagram`, `flowchart`) —
  renderizan directo en GitHub, no requieren herramienta externa.
- **No duplicar contenido ya citado**: un DOC-XXX nuevo referencia a los tomos oficiales y a los
  DOC-XXX previos por sección (incluidos los de otro sistema, ej. `aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md`
  desde `aidlc-docs/ccp/`), no repite su contenido.
- Los DOC-XXX ya numerados de antemano en un README (ej. `core/README.md` "Documentos
  relacionados" listando DOC-006 a DOC-011 como pendientes) mantienen esa numeración cuando se
  escriben — no se renumeran.
- Una fase que toca varias capas a la vez (CORE→CIS→WEB→devops, ver DOC-021) sigue documentándose
  bajo el sistema donde nace la decisión de diseño — no se crea una subcarpeta por fase separada
  de la de sistema.

## Git / commits

- `main` protegida — nunca push directo, siempre PR con CI en verde (ver
  [`devops/README.md`](devops/README.md) Rama `main`).
- Nunca commitear directo a `main` — todo cambio, incluido este archivo, se hace en una rama
  propia y se mergea vía PR.
- No borrar ramas, ni siquiera después de mergear el PR — ni localmente ni en el remoto.
- Mensajes de commit: `<tipo>: <descripción>` (`feat`, `fix`, `refactor`, `docs`, `test`,
  `chore`, `perf`, `ci`), en español, describiendo el *por qué* más que el *qué*.
- Commits agrupados por tema: si un cambio de sesión mezcla más de un tema (ej. "corregir docs
  desactualizadas" + "incorporar contenido nuevo"), preferir un solo commit bien descrito con
  bullets por tema en vez de forzar múltiples commits sobre archivos con hunks mezclados.
- **Incrementos multi-fase (una fase de `ROADMAP.md`, un DOC-XXX con varias capas CORE/CIS/WEB)
  usan `gh stack`** (extensión oficial `github/gh-stack`, instalada — ver `gh stack --help`) en
  vez de armar la cadena de ramas/PRs a mano: `gh stack init` sobre la primera rama de la fase,
  `gh stack add <rama>` por cada fase siguiente (cada una construida sobre la anterior, mismo
  patrón ya usado en DOC-021: diseño → CORE → CIS → WEB → devops), `gh stack submit` para crear
  los PRs apilados de una, y `gh stack merge` para mergearlos en orden una vez que el CI de cada
  uno esté verde — hace el retarget de cada base automáticamente al mergear el anterior, en vez de
  `gh pr edit --base main` manual por cada PR. `delete_branch_on_merge` está en `false` a nivel de
  repo, así que `gh stack merge` no viola la regla de "no borrar ramas" de arriba. Para un cambio
  de una sola capa (un fix, un doc suelto), seguir con una rama y un PR normal — `gh stack` es
  para cuando la dependencia entre fases es real, no para todo cambio.

## CI / calidad

- Cada sistema (`cis/`, `core/`) tiene su propio workflow en `.github/workflows/` — corre lint,
  unit tests con cobertura, e2e contra Postgres real (Testcontainers-style service en GitHub
  Actions, no mocks), build y `docker build`. Ver `core-ci.yml`/`cis-ci.yml` como plantilla al
  agregar un sistema nuevo.
- Quality Gate de SonarCloud es obligatorio — no usar `// NOSONAR` para silenciar un hallazgo
  real; solo para falsos positivos confirmados, y siempre con un comentario explicando por qué
  (ver `.sonarcloud.properties` y el historial de `fix: corregir NOSONAR mal ubicado...`).
- Boilerplate generado por Nest CLI (specs de humo, configs de eslint) está excluido del análisis
  de duplicación a propósito — no es señal de deuda técnica real entre `cis/` y `core/`.

## Al agregar un sistema nuevo

Seguir el patrón ya usado por `cis/` y `core/`: esqueleto NestJS (`ADR-001`), `Dockerfile`
multi-stage, workflow de CI dedicado con path filter (`paths: ["<sistema>/**", ...]`), README con
la misma estructura que los demás, y sin acceso directo a Base Patrimonial si el sistema es una
fuente de captura (debe pasar por CIS/CORE).

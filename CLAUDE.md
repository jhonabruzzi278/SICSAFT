# SICSAFT — reglas del repo

Monorepo de varios sistemas independientes (no workspace/npm-workspaces): cada carpeta de nivel
raíz (`cis/`, `core/`, `ccp/`, `cip/`, ...) es su propio desplegable con su propio
`package.json`, `Dockerfile` y pipeline de CI. Ver [README.md](README.md) para el mapa completo de
sistemas y [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md) para el marco de arquitectura.

Excepciones que **no** son desplegables (sin `Dockerfile` ni workflow de CI): `landing/` (Vercel),
`app-qr-sicsaft/` (Vercel — ver "CI / calidad") y `herramientas/` — carpeta de tooling que corre
del lado del operador o empaquetada dentro de otro sistema, no en su propio contenedor. Hoy
`herramientas/etl-contable/` (ETL Python del Excel contable, invocado por `sicsaft-core`, DOC-029).
`apk-aft/` (WebView Android de DOC-029 RF-H) seguirá el mismo criterio cuando exista.

**Dos portales, dos roles, dos logins — nunca uno compartido** (DOC-022): `ccp/` (ex-`web/`) es
exclusivo del Profesional de AFT y `core/frontend/` del Directivo. El portal del Administrador del
Sistema (`web_admin/`) se eliminó (2026-09): esa función — crear/editar Organización, Contrato,
Sede, usuarios — pasó a ser intervención directa del proveedor externo (BD / script con
service-token) + el bootstrap del wizard, y el diagnóstico de errores se hace por la consola de
logs de `sicsaft-core`. `core/` es el único sistema con dos deployables (`core/` = backend NestJS,
`core/frontend/` = SPA) — el frontend le habla a CIS, nunca a CORE directo (ver
[ADR-003](adr/ADR-003-frontend-de-core-para-directivo.md)), así que la regla de abajo sigue
aplicando sin excepción.

**Nomenclatura vigente**: [NOMENCLATURA.md](NOMENCLATURA.md) es el catálogo maestro (Tomo IV).
Denominación obligatoria: **BPI — Base Patrimonial Inteligente** (nombre histórico: "Base
Patrimonial Central", **depreciado** 2026-09-02); **CCP ≠ CIP** (Control vs. Inteligencia); niveles
= **Modo Básico / Modo Profesional / Modo Enterprise**; el CCP está en todos los niveles, CIP entra
en Nivel 2. Un doc o comentario que diga "Base Patrimonial Central" está desactualizado — se
corrige, no se cita.

## Arquitectura del ecosistema (flujo de datos)

```
Fuentes de captura (APP SICSAFT/QR, CCP/WEB, RFID, ERP, ...)
        ↓
      CIS (interoperabilidad — cis/, NestJS)
        ↓
    SICSAFT CORE (orquestador + motores — core/, NestJS)
        ↓
  BPI — Base Patrimonial Inteligente (fuente única de verdad — Postgres)
        ↓
      CIP (inteligencia patrimonial — cip/, Nivel 2)
        ↓
  Usuarios / Organización (ccp/, core/frontend/)
```

- **`cis/`** — backend NestJS, único punto de entrada para fuentes de captura (proxy delgado hacia
  CORE, auth Zitadel, circuit breaker/reintentos/rate limiting). Nunca escribe directo a la BPI.
- **`core/`** — backend NestJS, orquestador + motores (Patrimonial, Reglas, Eventos, Auditoría).
  Único sistema con dos deployables: el backend (`core/`) y su SPA (`core/frontend/`, portal del
  Directivo). El frontend habla con CIS, nunca directo al backend de CORE ([ADR-003](adr/ADR-003-frontend-de-core-para-directivo.md)).
- **`ccp/`, `core/frontend/`** — dos SPAs Vite/React independientes, un portal por rol (Profesional
  de AFT / Directivo), cada una con su propio login OIDC/PKCE contra Zitadel. No comparten sesión
  ni código entre sí.
- **`base-patrimonial/`** — modelo de dominio de la BPI (Base Patrimonial Inteligente), documentado
  y versionado en `core/migrations/` (Postgres real).
- **`devops/`** — tres stacks Docker Compose independientes, uno por entorno: `local/` (desarrollo
  — Traefik + Postgres + Zitadel + los 6 sistemas desplegables `cis`/`core`/`cip`/`ccp`/
  `core-frontend` + observabilidad self-hosted Prometheus/Loki-Promtail/Grafana,
  equivalente a CloudWatch/CloudTrail administrado por el operador del VPS — `app-qr-sicsaft/` es
  un PWA cliente sin contenedor propio en ningún stack), `prod/` (mismo VPS propio, orquestado por
  **Coolify** en vez de un Traefik propio) y `onprem/` (instalación aislada por cliente sobre
  **Podman**, no Docker Desktop, empaquetada como instalador `.exe` con Inno Setup en
  `devops/onprem/installer/`). Detalle de cada uno en [devops/README.md](devops/README.md).

Estado real y detalle de cada sistema (qué está mockeado vs. real, endpoints, dependencias): tabla
completa en [README.md](README.md) y el `README.md` propio de cada carpeta.

## Comandos por sistema

`cis/`, `core/` y `cip/` son NestJS (Jest); `ccp/`, `app-qr-sicsaft/` y `core/frontend/` son Vite/React. `ccp/` y
`core/frontend/` tienen ESLint + Vitest (unit) — `app-qr-sicsaft/`
todavía no tiene ninguno de los dos configurado. Playwright (e2e) existe en `ccp/` y
`app-qr-sicsaft/`; inexistente en `core/frontend/`. Cada
comando corre desde la carpeta del sistema.

**Backends (`cis/`, `core/`, `cip/`):**
```bash
npm run start:dev          # dev server con watch
npm run lint:ci             # eslint --max-warnings=0 (lo que corre CI; usar "lint" a secas para autofix local)
npm test                    # jest (unit)
npx jest ruta/al.spec.ts    # un solo archivo de test
npx jest -t "nombre del test"  # un solo test por nombre
npm run test:cov            # cobertura — umbral en package.json > jest.coverageThreshold (100% líneas/funciones en los tres)
npm run test:e2e            # jest contra ./test/jest-e2e.json (Postgres real en CI, no mocks)
npm run build                # nest build
```
`core/` y `cip/` además tienen `npm run migrate:up` / `migrate:down` (`node-pg-migrate` sobre
`core/migrations/` y `cip/migrations/` respectivamente — bases Postgres separadas, RNF-01/RNF-05).
`cip/` además corre un worker `pg-boss` (`AgregacionModule`, ADR-005) contra la cola `cip-eventos`
que puebla consumiendo eventos reales de `core/`, no expone frontend propio — ver `cip/README.md`.

**Frontends, todas (`ccp/`, `app-qr-sicsaft/`, `core/frontend/`):**
```bash
npm run dev                  # vite
npm run build                 # tsc -b && vite build
```

**`ccp/` y `core/frontend/` además tienen:**
```bash
npm run lint:ci               # eslint --max-warnings=0 (mismo criterio que cis/core)
npm test                      # vitest run — hoy solo cubre src/lib/oidc/ (PKCE/tokens/refresh, DOC-023)
npx vitest run src/lib/oidc/pkce.test.ts   # un solo archivo de test
npm run test:cov              # vitest run --coverage
```

**`ccp/` y `app-qr-sicsaft/` además tienen e2e real** (`core/frontend/` no tiene e2e):
```bash
npm run test:e2e              # playwright test
npx playwright test archivo.spec.ts   # un solo archivo e2e
```

**Stack local completo** (Traefik + Postgres + Zitadel + los 6 sistemas desplegables +
observabilidad self-hosted — Prometheus/Loki/Grafana):
```bash
cd devops/local && docker compose up -d
```
Ver [`devops/local/README.md`](devops/local/README.md) para variables de entorno, dominios
locales, y la sección "Observabilidad" (URLs de Grafana, qué mide cada componente, limitación
conocida de cAdvisor en Docker Desktop).

**Instalación on-premise por cliente** (Nivel 1/Nivel 2, Podman — no Docker Desktop):
```powershell
cd devops/onprem
./instalar-cliente.ps1 -ClienteNombre "Nombre Cliente" -OrganizacionId "id-cliente" -Nivel 2
```
Automatiza WSL2/Podman, genera `.env`, bootstrap de Zitadel (PAT auto-provisionado, sin Console) y
levanta el stack con smoke check al final. Empaquetado como instalador `.exe` (Inno Setup) en
[`devops/onprem/installer/`](devops/onprem/installer). Ver
[`devops/onprem/README.md`](devops/onprem/README.md).

**Producción** (`devops/prod/docker-compose.yml`) no se corre a mano — la redespliega **Coolify**
vía webhook sobre el VPS propio. Ver [`devops/prod/README.md`](devops/prod/README.md).

**Herramienta ETL contable** (`herramientas/etl-contable/`, Python — DOC-029 RF-B):
```bash
cd herramientas/etl-contable
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # pandas, xlrd
python etl_contable.py --entrada archivo.xls --mapeo mapeo/mapeo-<org>.json --salida -
python -m pytest                # tests con un .xls fixture
ruff check .                     # lint (mismo criterio que lint:ci de los sistemas Node)
```

No hay comando de build/test a nivel raíz del repo — cada sistema se construye y testea de forma
aislada dentro de su propia carpeta.

## Reglas no negociables del ecosistema

**Ninguna fuente de captura (APP SICSAFT/QR, CCP/WEB, RFID, ERP) puede modificar la BPI (Base
Patrimonial Inteligente) directamente.** Todo pasa por `CIS → CORE`. Esto viene de Tomo III
(principio no negociable) / Tomo IV 1.7 y está grabado en el diagrama de [README.md](README.md) y
en [NOMENCLATURA.md, principio no negociable](NOMENCLATURA.md). Ningún cambio de código debe crear un atajo que la rompa
(ej. un servicio nuevo que le escriba a `base-patrimonial`/Postgres sin pasar por `core/`). Único
`write` patrimonial que no pasa por `CIS→CORE`: el `provisionarOrganizacionCore` del wizard del
`.exe` (bootstrap del instalador, pre-autenticación, `INSERT` directo — documentado en DOC-028 B.2,
no es una fuente de captura).

**Ningún registro oficial de la BPI (Organización, Sede, Contrato, Activo,
Responsable) se borra con `DELETE` real.** Se da de baja con un campo `estado` bidireccional
(`activo`/`inactivo`, o la máquina de estados propia de la entidad), nunca eliminando la fila.
Esto viene de Tomo III 4.10 y ya tiene precedente real en el esquema: `activos.estado`,
`responsables.estado`, y desde
[DOC-024](aidlc-docs/ccp/design-artifacts/DOC-024-crud-completo-auditoria-identidad.md) también
`organizaciones.estado`/`sedes.estado`. La única excepción documentada es `documentos_activo`
(comentario explícito en `core/migrations/1755800000000_gaps-ccp-y-admin-sistema.ts` sobre por qué
no aplica). Antes de agregar un `DELETE` real a una tabla nueva de la BPI, confirmar
primero que la entidad no sea un registro oficial cubierto por este invariante.

## Fuente de verdad de cada decisión

- **Nomenclatura vigente (nombres de componentes, niveles/modos, conceptos patrimoniales)**:
  [NOMENCLATURA.md](NOMENCLATURA.md) — catálogo maestro del Tomo IV. "Base Patrimonial Central"
  está depreciada (→ BPI); `CCP ≠ CIP`; niveles = Modo Básico/Profesional/Enterprise; CIP entra en
  Nivel 2. Un doc anterior que use el término viejo es un snapshot, no un precedente.
- **Qué debe hacer cada sistema y qué reglas de negocio cumple**: los tomos oficiales
  (`TOMO III Cap.1/4`, `TOMO IV Cap.1/2`), citados por sección (`x.y`) en cada README y en
  `base-patrimonial/DOC-004-modelo-contrato.md`. Si el código y un README citando un tomo
  entran en conflicto, el tomo gana — corregir el código o levantar la discrepancia, nunca
  editar la cita para que calce.
- **Cómo construir eso de forma escalable/resiliente**: [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md).
- **Identidad visual / paleta de colores**: [BRAND.md](BRAND.md), origen canónico en
  `landing/src/style.css` — no reinventar colores por sistema en trabajo de frontend (`ccp/`,
  `core/frontend/`, `app-qr-sicsaft/`, `cip/`).
- **Decisiones de stack ya tomadas**: [`adr/`](adr) (NestJS, Postgres, `pg-boss`, Zitadel
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
- **Excepción para diagramas HTML sueltos** (no Mermaid, para diagramas más elaborados): no van en
  el `design-artifacts/` de un sistema, viven todos juntos en `aidlc-docs/diagrams/`, nombrados por
  tema y no por sistema, sea un diagrama de un sistema puntual (`db-schema-core.html`) o del
  ecosistema completo (`organigrama-roles.html`, `grafo-dependencias-sistema.html`).
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

- Los cinco sistemas desplegables (`cis/`, `core/`, `cip/`, `ccp/`, `core/frontend/`)
  tienen su propio workflow en `.github/workflows/` con `paths` filtrado a su carpeta. `cis/`,
  `core/` y `cip/` corren lint, unit tests con cobertura, e2e contra Postgres real
  (Testcontainers-style service en GitHub Actions, no mocks), build y `docker build`. `ccp/` y
  `core/frontend/` corren lint, `vitest run --coverage`, build y `docker build` (con
  placeholders `VITE_*`, nunca hosts reales); solo `ccp/` corre además Playwright e2e en CI. Ver
  `core-ci.yml`/`cis-ci.yml` como plantilla para un sistema backend nuevo, o `ccp-ci.yml` para uno
  frontend.
- Quality Gate de SonarCloud es obligatorio — no usar `// NOSONAR` para silenciar un hallazgo
  real; solo para falsos positivos confirmados, y siempre con un comentario explicando por qué
  (ver `.sonarcloud.properties` y el historial de `fix: corregir NOSONAR mal ubicado...`).
- Boilerplate generado por Nest CLI (specs de humo, configs de eslint) está excluido del análisis
  de duplicación a propósito — no es señal de deuda técnica real entre `cis/`, `core/` y `cip/`.
- `app-qr-sicsaft/` es la excepción al pipeline de arriba: se despliega directo a **Vercel**
  (`.vercel/repo.json`, proyecto `sicsaft`), por eso no tiene workflow en `.github/workflows/`
  ni `docker build`.
- `herramientas/etl-contable/` tampoco tiene workflow propio (no es desplegable): su verificación
  es `pytest` + `ruff` (correr desde la carpeta) y se ejercita end-to-end dentro del e2e de `core/`
  (ciclo lote → aprobar/rechazar contra Postgres real). `apk-aft/` (DOC-029 RF-H) sí tendrá uno
  (`apk-aft-ci.yml`: Android SDK + Gradle + firma con keystore de CI) cuando exista.

## Al agregar un sistema nuevo

Seguir el patrón ya usado por `cis/` y `core/`: esqueleto NestJS (`ADR-001`), `Dockerfile`
multi-stage, workflow de CI dedicado con path filter (`paths: ["<sistema>/**", ...]`), README con
la misma estructura que los demás, y sin acceso directo a la BPI si el sistema es una
fuente de captura (debe pasar por CIS/CORE).

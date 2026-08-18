# SICSAFT — reglas del repo

Monorepo de varios sistemas independientes (no workspace/npm-workspaces): cada carpeta de nivel
raíz (`cis/`, `core/`, `web/`, ...) es su propio desplegable con su propio `package.json`,
`Dockerfile` y pipeline de CI. Ver [README.md](README.md) para el mapa completo de sistemas y
[ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md) para el marco de arquitectura.

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

Toda fase de trabajo no trivial (una fase de `ROADMAP.md`, una feature nueva) se documenta con la
carpeta `aidlc-docs/` dentro del sistema que la implementa, **antes** de escribir código —
patrón ya usado por `app-qr-sicsaft/aidlc-docs/` (primer sistema) y `core/aidlc-docs/` (segundo,
Fase 2). Estructura estándar:

```
<sistema>/aidlc-docs/
├── 00_PROJECT_METADATA.md        # estado de fase (Inception/Construction/Operations), quick links
├── requirements/
│   ├── INTENT.md                  # que se pidio, por que ahora, que NO es esta fase
│   └── REQUIREMENTS.md            # funcionales/no funcionales, con ID (RF-XX/RNF-XX) y fuente
├── story-artifacts/
│   └── USER_STORIES.md            # desde la perspectiva del consumidor real, con criterios de aceptacion
├── design-artifacts/
│   ├── DOMAIN_MODEL.md            # entidades + diagramas (mermaid erDiagram/stateDiagram)
│   ├── ARCHITECTURE.md            # mapa de modulos + diagramas de secuencia
│   └── DOC-XXX-*.md               # contratos/documentos numerados, mismo esquema que DOC-002/004/005
└── testing/
    └── TEST_STRATEGY.md           # que se testea y como, sin bajar el umbral de cobertura vigente
```

- **Diseño antes que código**: cuando el usuario pide explícitamente diseñar primero, generar
  todo `aidlc-docs/` de la fase, presentarlo, y esperar confirmación antes de tocar `src/`.
- **Diagramas en Mermaid** (`erDiagram`, `stateDiagram-v2`, `sequenceDiagram`, `flowchart`) —
  renderizan directo en GitHub, no requieren herramienta externa.
- **No duplicar contenido ya citado**: un DOC-XXX nuevo referencia a los tomos oficiales y a los
  DOC-XXX previos por sección, no repite su contenido.
- Los DOC-XXX ya numerados de antemano en un README (ej. `core/README.md` "Documentos
  relacionados" listando DOC-006 a DOC-011 como pendientes) mantienen esa numeración cuando se
  escriben — no se renumeran.

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

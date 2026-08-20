# Test Strategy — CORE Fase 2

Mismo patrón que ya usa `core/src/entitlements/` (Fase 0) — sin relajar el umbral de cobertura
(`package.json`: 100% stmts/lines/funcs, branches sobre el piso del proyecto, RNF-03).

## Unit tests

- `clasificarEscaneo` (DOC-009): las 8 categorías + el orden de precedencia de 3 (ej.
  `ya_escaneado` gana sobre `duplicado`), tabla de casos uno por rama del árbol de decisión.
- `ActivoRepository`, `EventoRepository`, `AuditoriaRepository`: mockeando `pg.Pool`, mismo
  patrón que `contrato.repository.spec.ts`.
- `OrquestadorService`: que audita incluso en la rama de rechazo (RF-04) — caso explícito con un
  motor que lanza y verificar que igual se llama a `AuditoriaRepository.registrar`.

## E2E (contra Postgres real, mismo patrón que `test/entitlements.e2e-spec.ts`)

- `POST /inventarios` con una sesión de 3 escaneos (uno de cada: `correcto`, `otra_area`,
  `no_registrado`) contra el seed de DOC-005 (notebook/proyector de DUOC UC) — verifica que las
  filas de `inventarios` quedan con el `resultado` recalculado por CORE, no el que mandó el
  request.
- Idempotencia: mismo `idempotencyKey` dos veces → mismo `inventarioId`, sin duplicar filas.
  Mismo `idempotencyKey` con payload distinto → `409`.
- `GET /catalogo` paginado — verifica que no devuelve más de `limit` sin cursor.
- `GET /inventarios/:id/estado` sobre una sesión recién creada.

## Contract test CIS↔CORE (pendiente de decidir herramienta — no bloquea esta fase)

`ARQUITECTURA-WAF.md` 2 ya menciona "contract tests CIS↔CORE" como parte de la pirámide de
testing del ecosistema, sin herramienta elegida (`devops/README.md` Estrategia de testing). No
se resuelve en Fase 2 — los e2e de CIS contra un CORE real en Docker (ya existentes desde Fase 0,
`docker network` + `docker exec`) cubren el caso mientras tanto.

## Qué NO se testea en esta fase

- Carga/estrés (k6) — cron aparte, no en cada PR (`devops/README.md`).
- Mutation testing (Stryker) — mencionado como objetivo en `devops/README.md` pero sin adoptar
  todavía en ningún sistema del repo; no se introduce recién en Fase 2 sin que el resto del
  proyecto ya lo use (consistencia).

# Test Strategy — CIP: primer dashboard (Fase 6)

Mismo umbral de cobertura vigente en el ecosistema (unit 100% stmts/lines/funcs en CORE — CIP
adopta el mismo estándar por ser un sistema Nest nuevo, ver `CLAUDE.md` CI/calidad). Sin bajar
el umbral por ser un sistema nuevo.

## 1. CORE — outbox
- **Unit**: el trigger de Postgres no es testeable con Jest — se prueba con un e2e real (abajo).
  `EventosOutboxDispatcher` sí: mock del `Pool`/cliente pg-boss (ADR-005, antes Redis), casos:
  publica pendientes, no publica ya publicados, agrupa por `sesionId` (4 de ARCHITECTURE.md — un
  solo mensaje por sesión, no uno por evento), no revienta si la base de la cola no responde (deja
  pendiente, no marca `publicado`).
- **e2e (Postgres real)**: insertar en `eventos` vía el flujo real (`POST /inventarios`,
  `POST /activos`, etc. ya existentes) y verificar que `eventos_outbox` recibe la fila esperada
  con `publicado = false` — prueba el trigger de verdad, no un mock de él. Caso de idempotencia:
  reintento de `POST /inventarios` con la misma `idempotencyKey` no debe duplicar filas en
  `eventos_outbox` (ya lo garantiza `resolverReintento`, que no vuelve a llamar
  `registrarEventosDeEscaneo` — el test solo confirma que ese invariante se sostiene con el
  trigger nuevo encima).

## 2. CIP — worker de agregación
- **Unit**: lógica de recalculo por tipo de agregado (`ARCHITECTURA.md` 3), con datos de CORE
  mockeados (respuestas de `GET /catalogo`/`GET /inventarios/:id`) — no contra Postgres real, es
  lógica pura de transformación.
- **Unit — veredicto recalculado**: portar los casos de
  `app-qr-sicsaft/tests/fase-3.1.spec.js` (exitoso/aceptable/defectuoso) como unit tests de la
  función de veredicto propia de CIP (`ARCHITECTURE.md` 5) — mismos 3 casos, misma tabla de
  verdad, implementación independiente pero comportamiento idéntico verificado.
- **Integration**: consumidor pg-boss real contra un Postgres de test (ADR-005, antes BullMQ/Redis
  — mismo patrón que Testcontainers-style ya usa CI para Postgres, `CLAUDE.md` CI/calidad) — publica
  un mensaje `sesion-cerrada`, verifica que el worker escribe los agregados esperados en la base
  `cip` real.

## 3. CIP — API de lectura
- **e2e (Postgres real, base `cip`)**: cada endpoint de `ARCHITECTURE.md` 6 contra datos ya
  agregados (seed de test) — incluye el caso RF-10: `SYNC_ESTADO.alDia = false` cuando
  `ultimoEventoProcesadoEn` supera el umbral, la API igual responde 200 con los datos + el
  timestamp.
- **Paginación** (RNF-02): mismo patrón que `core/test/*.e2e-spec.ts` ya usa para `GET /catalogo`
  — límite por defecto, tope máximo, `total` correcto.

## 4. Degradación (RF-10) — caso explícito
- Simular la base `eventos_outbox` caída (contenedor detenido en el entorno de test) →
  `POST /inventarios` de CORE sigue devolviendo 2xx (no depende de esa base en su camino síncrono)
  → `eventos_outbox` acumula filas sin publicar → al levantarla de nuevo, el dispatcher las publica
  en el siguiente ciclo, sin pérdida. Este es el test que valida RNF-03 de punta a punta, no solo
  por unidad.

## 5. Fuera de alcance de testing en este incremento
Frontend de CIP (no existe todavía, ver `requirements/INTENT.md`), informe diario automático (no
diseñado en este incremento).

# Intent — CIP: primer dashboard (Fase 6)

## Qué se pidió
El usuario pidió arrancar el diseño (metodología AI-DLC) de la Fase 6 del `ROADMAP.md`: el
primer dashboard del Centro de Inteligencia Patrimonial (CIP, SYS-06), hoy una carpeta placeholder
sin ningún código (`cip/README.md` Estado: "🔲 No iniciado").

## Por qué ahora
- Las Fases 0–5 y 3.1 ya están completas y mergeadas: CORE tiene datos reales (activos, eventos,
  sesiones de inventario) desde APP QR y WEB — recién ahora hay algo que un dashboard pueda medir
  (`ROADMAP.md` Fase 6 "Por qué acá").
- El spec funcional (`PROCESO MODULAR DE APLICACION SICSAFT, SOFTWARE.ppt`, revisado 2026-08-17)
  confirma dos necesidades de negocio adicionales para este mismo dashboard: gráfico circular por
  categoría de AFT y un informe diario automático — ya anotadas como pendientes en
  `REQUISITOS.md` "Requisitos nuevos identificados en spec funcional".
- Es el primer sistema del ecosistema que necesita el patrón de **outbox transaccional**
  (`ROADMAP.md` Fase 6: "Patrón a adoptar acá, no antes") — Motor de Eventos hoy solo inserta en
  `eventos`, sin publicar a nadie.

## Qué NO es esta fase (fuera de alcance deliberado)
- **Informe diario automático a hora fija** (spec pptx) — requiere un scheduler + un canal de
  entrega (correo, notificación) que no existe en ningún sistema del ecosistema todavía. Se deja
  como historia identificada pero sin diseñar en este incremento (ver
  `story-artifacts/USER_STORIES.md` Fuera de alcance) — evita mezclar "leer y mostrar datos" con
  "generar y enviar un documento programado", que son dos problemas de tamaño distinto.
- **Motor de Alertas** (Tomo IV 2.4) — sin consumidor real todavía, mismo criterio que
  `core/README.md` ya aplicó para no construirlo en Fase 2 (YAGNI).
- **Elegir un motor de datos analítico** (columnar, OLAP) — WAF 9 lo prohíbe explícitamente antes
  de tener el modelo de dominio de CORE estable y carga real medida. Este incremento usa Postgres
  (vistas materializadas / tablas de agregados propias de CIP), no un motor nuevo.
- **Multi-tenancy de infraestructura** (una base de datos de CIP por organización) — CIP ya filtra
  por `organizacionId` a nivel de fila, igual que CORE; separar infraestructura por organización no
  tiene motivo real todavía.
- **UI final del dashboard** (React/gráficos) — este incremento diseña el modelo de datos, la
  ingesta asíncrona y la API de lectura; el frontend de CIP es un incremento de Construction
  posterior, análogo a como Fase 5 primero definió DOC-013 y después construyó `ccp/`.

## Decisión abierta que este diseño resuelve
`cip/README.md` Depende de decía "idealmente vía un almacén de solo lectura / reporting, no
contra la Base Patrimonial transaccional directamente" — sin especificar el mecanismo. Este
documento fija esa decisión: outbox transaccional (trigger de Postgres, no cambios de código en
cada repositorio que ya escribe `eventos`) + cola pg-boss (`cip-eventos`, antes Redis/BullMQ desde
ADR-001 — ver [ADR-005](../../../adr/ADR-005-postgres-pgboss-reemplaza-redis.md), 2026-08-27) +
tablas de agregados propias de CIP en una base Postgres separada de `core` (ver
`design-artifacts/ARCHITECTURE.md`).

# Requirements — CIP: primer dashboard (Fase 6) + inteligencia decisional (Fase 9)

Fuente primaria de cada fila: `cip/README.md` "Primer dashboard previsto"/"Navegación prevista"
(ya citaba Tomo IV 2.4–2.14 vía `core/README.md`) y el spec funcional pptx (2026-08-17, filas
marcadas explícitamente). Numeración propia de este sistema (RF-01... como en `core/`, `ccp/`),
no continúa la de otros sistemas.

RF-11 a RF-17 (abajo) son un segundo incremento, agregado 2026-08-25: contenido de negocio
aportado directamente por el usuario ("CIP no debe limitarse a gráficos"), diseñado en
[DOC-026](../design-artifacts/DOC-026-cip-inteligencia-decisional.md). RF-01 a RF-10 (primer
incremento) quedan sin cambios.

## Funcionales

| ID | Requisito | Fuente |
|---|---|---|
| RF-01 | Mostrar por organización: activos registrados, activos escaneados (al menos una vez), % de cobertura de inventario | `cip/README.md` "Primer dashboard previsto" |
| RF-02 | Mostrar áreas controladas vs. pendientes en el período vigente | `cip/README.md` |
| RF-03 | Mostrar conteo de inventarios por veredicto de sesión: exitoso / aceptable / defectuoso | `cip/README.md` + `ROADMAP.md` Fase 3.1 (define el vocabulario del veredicto) |
| RF-04 | Mostrar activos fuera de área (resultado `otra_area`/`otra_ubicacion` del último escaneo conocido) | `cip/README.md` |
| RF-05 | Mostrar activos no localizados (`activos.estado = 'extraviado'`) | `cip/README.md` |
| RF-06 | Mostrar incidencias registradas (`inventarios.resultado = 'con_incidencia'`, con su observación) | `cip/README.md` |
| RF-07 | Mostrar distribución de activos por estado operativo (activo, mantenimiento, inactivo, dado de baja) | `cip/README.md` + DOC-005 4 |
| RF-08 | Navegación con drill-down: Organización → Sede → Área → Ubicación → Categoría → Activo | `cip/README.md` "Navegación prevista" |
| RF-09 | Gráfico circular de activos por categoría de catálogo (`catalogo_activos.familia`), filtrable por área | Spec pptx 2026-08-17, `REQUISITOS.md` fila "Gráfico circular por categoría de AFT" |
| RF-10 | Degradar a "últimos datos conocidos" (con timestamp de última actualización) si la fuente de eventos está caída, nunca mostrar un dashboard roto | WAF 8 fila CIP ("Resiliente"), `ROADMAP.md` Fase 6 "Done" |
| RF-11 | Listar activos sin verificar (sin inventario registrado) en el período vigente — complementa RF-01, que solo da el % agregado, no el detalle de cuáles | Usuario, 2026-08-25 ("¿qué activos no han sido verificados?") |
| RF-12 | Ranking de áreas por incidencias concentradas en el período vigente | Usuario, 2026-08-25 ("¿qué áreas concentran incidencias?") |
| RF-13 | Listar activos con mayor frecuencia de cambio de responsable en un período configurable | Usuario, 2026-08-25 ("¿qué activos cambian frecuentemente de responsable?") |
| RF-14 | Ranking de ubicaciones por mayor cantidad de diferencias (activos fuera de la ubicación esperada) | Usuario, 2026-08-25 ("¿qué ubicaciones presentan mayores diferencias?") |
| RF-15 | Score de riesgo por activo (fórmula simple y explicable, ver DOC-026) y listado ordenado de mayor a menor riesgo | Usuario, 2026-08-25 ("¿qué activos generan mayor riesgo?") |
| RF-16 | Serie temporal de evolución del patrimonio (cobertura/estado en el tiempo, vía snapshots periódicos) | Usuario, 2026-08-25 ("¿cómo evoluciona el patrimonio?") |
| RF-17 | Vista "revisión sugerida" para el responsable patrimonial — consulta compuesta que prioriza los hallazgos de RF-11 a RF-16 | Usuario, 2026-08-25 ("¿dónde existen inconsistencias?" / "¿qué debe revisar el responsable patrimonial?") |

## No funcionales

| ID | Requisito | Fuente |
|---|---|---|
| RNF-01 | CIP nunca consulta la Base Patrimonial transaccional directamente — solo su propio almacén de lectura, alimentado async | WAF 5, `cip/README.md` "Depende de" |
| RNF-02 | Todo listado del dashboard es paginado desde el diseño (mismo criterio que CORE/CIS, WAF 5) | WAF 5 |
| RNF-03 | La ingesta de eventos hacia CIP no puede perder ni duplicar eventos si el proceso muere entre el insert en Postgres y la publicación a la cola | `ROADMAP.md` Fase 6 "Patrón a adoptar acá, no antes" (outbox transaccional) |
| RNF-04 | CIP escala de forma independiente de CORE — un pico de consultas al dashboard no puede degradar `POST /inventarios` | WAF 8 fila CIP ("Escalable") |
| RNF-05 | No introducir un motor de base de datos analítico (columnar/OLAP) en este incremento | WAF 9 |
| RNF-06 | El score de riesgo (RF-15) es una fórmula fija y explicable, versionada en código — nunca un modelo predictivo/ML | WAF 9 y Tomo III 1.2 ("nunca funciones que el mercado aún no demanda"), IA/ML explícitamente en Etapa 4, `ROADMAP.md` "YAGNI" |
| RNF-07 | RF-11 a RF-17 mantienen el mismo patrón asíncrono/batch de RF-01 a RF-10 (RNF-01/RNF-03) — ningún cálculo nuevo es tiempo real | Mismo criterio que RNF-01/RNF-03 |

## Explícitamente fuera de alcance de este incremento (ver INTENT.md)

| Ítem | Motivo |
|---|---|
| Informe diario automático a hora fija | Requiere scheduler + canal de entrega, no diseñado en ningún sistema todavía |
| Motor de Alertas | Sin consumidor real (YAGNI, mismo criterio que Fase 2) |
| Motor de datos analítico dedicado | WAF 9 lo prohíbe antes de modelo de CORE estable |
| UI final (React) del dashboard | Incremento de Construction posterior a este diseño |
| Modelo predictivo/ML para el score de riesgo (RF-15) | RNF-06 — excluido explícitamente, no solo diferido |
| Implementación de RF-11 a RF-17 (`cip/src/`) | Este incremento (2026-08-25, DOC-026) es diseño únicamente — Inception, no Construction |

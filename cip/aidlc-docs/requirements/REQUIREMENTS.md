# Requirements — CIP: primer dashboard (Fase 6)

Fuente primaria de cada fila: `cip/README.md` "Primer dashboard previsto"/"Navegación prevista"
(ya citaba Tomo IV 2.4–2.14 vía `core/README.md`) y el spec funcional pptx (2026-08-17, filas
marcadas explícitamente). Numeración propia de este sistema (RF-01... como en `core/`, `web/`),
no continúa la de otros sistemas.

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

## No funcionales

| ID | Requisito | Fuente |
|---|---|---|
| RNF-01 | CIP nunca consulta la Base Patrimonial transaccional directamente — solo su propio almacén de lectura, alimentado async | WAF 5, `cip/README.md` "Depende de" |
| RNF-02 | Todo listado del dashboard es paginado desde el diseño (mismo criterio que CORE/CIS, WAF 5) | WAF 5 |
| RNF-03 | La ingesta de eventos hacia CIP no puede perder ni duplicar eventos si el proceso muere entre el insert en Postgres y la publicación a la cola | `ROADMAP.md` Fase 6 "Patrón a adoptar acá, no antes" (outbox transaccional) |
| RNF-04 | CIP escala de forma independiente de CORE — un pico de consultas al dashboard no puede degradar `POST /inventarios` | WAF 8 fila CIP ("Escalable") |
| RNF-05 | No introducir un motor de base de datos analítico (columnar/OLAP) en este incremento | WAF 9 |

## Explícitamente fuera de alcance de este incremento (ver INTENT.md)

| Ítem | Motivo |
|---|---|
| Informe diario automático a hora fija | Requiere scheduler + canal de entrega, no diseñado en ningún sistema todavía |
| Motor de Alertas | Sin consumidor real (YAGNI, mismo criterio que Fase 2) |
| Motor de datos analítico dedicado | WAF 9 lo prohíbe antes de modelo de CORE estable |
| UI final (React) del dashboard | Incremento de Construction posterior a este diseño |

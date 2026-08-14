# SICSAFT CORE (SYS-03)

## Objetivo
Núcleo operativo del Modelo Inteligente de Gestión Patrimonial (Tomo IV, Cap. 2). Administra,
coordina, controla y supervisa todo el ciclo de vida de los Activos Fijos Tangibles. Es el
**único** componente autorizado a modificar la Base Patrimonial Central — todas las tecnologías,
aplicaciones y sistemas externos interactúan con el patrimonio exclusivamente a través del CORE.

## Estado
🟡 Esqueleto NestJS (mismo patrón que `../cis/`) + **`GET /entitlements` real sobre Postgres**
([DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) §6): resuelve el modelo de `Contrato`
contra una base `core` dedicada con esquema versionado por migraciones (`migrations/`,
node-pg-migrate — ver "Desarrollo local"; mismo caso DUOC UC/Melipilla que ya usa CIS, cargado por
la migración de seed a partir de `src/entitlements/contrato.seed.ts`, ya no retipeado a mano en
SQL), con la máquina de estados y el invariante "una sede, un contrato
vigente" de DOC-004 §3/§4 implementados, validados en `ContratoRepository` al leer (no solo en el
seed de tests, ver `src/entitlements/contrato.seed.ts`) y testeados. Todo probado con lint, unit
(100% stmts/lines/funcs, branches sobre el umbral del proyecto), e2e contra Postgres real, build y
`docker build`/`docker run` real conectado a esa base — corre como servicio `core` en
`../devops/local/docker-compose.yml`, sin ruta de Traefik a propósito (solo lo consume CIS dentro
de la red de contenedores, nunca un navegador directo).

**CIS ya llama a este endpoint, y CORE ya valida quién le habla**: `auth/session` usa
`CoreClientService` (`cis/src/core-client/`) para pedir entitlements reales acá; `GET
/entitlements` está detrás de `ServiceTokenGuard` (`src/common/auth/`), que exige el header
`x-internal-service-token` con un secreto compartido (`CORE_SERVICE_TOKEN`, comparado en tiempo
constante para evitar timing attacks) — sin el header correcto, 401. Verificado con conectividad
real entre contenedores `cis`↔`core` (`docker network` + `docker exec`, probando los 3 casos: sin
header, header correcto, header incorrecto), no solo con mocks. Toda ruta pasa además por
`CorrelationIdMiddleware` (`src/common/correlation-id/`, ROADMAP.md Fase 0): acepta/genera
`X-Correlation-Id` y lo devuelve en la respuesta — CIS ya lo propaga al llamar acá. Todavía sin
logging estructurado que lo use (WAF §2, pendiente).

**Fase 2 (Orquestador + 4 motores de lectura) ya implementada** — diseño completo en
[`core/aidlc-docs/`](aidlc-docs/00_PROJECT_METADATA.md) (DOC-006 a DOC-011), código real sobre
[DOC-005](../base-patrimonial/DOC-005-modelo-patrimonial.md):
- `GET /catalogo` (Motor Patrimonial, `src/patrimonial/`) — paginado, por
  organización/área/ubicación.
- `POST /inventarios` (Orquestador + Motor de Reglas + Motor Patrimonial + Motor de Eventos,
  `src/orquestador/` + `src/inventarios/` + `src/reglas/` + `src/eventos/`) — clasifica cada
  escaneo contra la Base Patrimonial real en una de las 8 categorías (DOC-009), idempotente
  (`sesiones_inventario`, migración `1755200000000`), auditado siempre — éxito o rechazo — por
  el Motor de Auditoría (`src/auditoria/`).
- `GET /inventarios/:id/estado`.

Verificado igual que el resto del sistema: unit (100% stmts/lines/funcs, 90%+ branches), e2e
nuevo (`test/inventarios.e2e-spec.ts`) contra Postgres real, `docker build`/`docker run` real con
`GET /catalogo` y `POST /inventarios` respondiendo contra la base migrada. Motor de Alertas y
Motor de Reportes quedan fuera a propósito — sin consumidor real (ver DOC-008).

**Fase 4 (Administrador Patrimonial) — completa, items 1/3/4/5 implementados**: diseño completo en
[`seguridad/DOC-012-administrador-patrimonial.md`](../seguridad/DOC-012-administrador-patrimonial.md).
El Motor Patrimonial ya cubre el resto del ciclo de vida de `Activo` que DOC-008 dejaba para esta
fase: `POST /activos` (alta), `POST /activos/:id/baja`, `POST /activos/:id/reincorporacion`,
`PATCH /activos/:id/responsable` (`src/patrimonial/activo-escritura.controller.ts` +
`escritura-activo.service.ts`), todos detrás de `ServiceTokenGuard` con la autorización de rol
(`administrador-patrimonial`, verificada **por organización** — no solo "¿tiene el rol en algún
lado?") resuelta dentro de `OrquestadorService` para que un 403 por falta de rol también quede
auditado. `ActivoRepository` cruza la organización del payload contra la organización real del
activo objetivo antes de escribir (defensa en profundidad, 404 si no coincide) — corrige un
hallazgo real de revisión de seguridad encontrado durante este mismo incremento. Se suman
`POST /importaciones/contable` (`src/patrimonial/importacion-contable.*` — idempotente por fila,
nunca sobrescribe ni elimina, DOC-012 §6) y `POST /contratos` + `PATCH /contratos/:id`
(`src/entitlements/contrato-escritura.controller.ts` + `escritura-contrato.service.ts` — valida el
invariante DOC-004 §4 y la máquina de estados DOC-004 §3, DOC-012 §7; la escritura de `Contrato`
corre en una transacción real vía `pool.connect()` porque un e2e contra Postgres real encontró que
sin ella un FK inválido en `contrato_sedes` dejaba un contrato huérfano sin ninguna sede).
Verificado con unit (100% stmts/lines/funcs) + e2e reales contra Postgres
(`test/activo-escritura.e2e-spec.ts`, `test/contrato-escritura.e2e-spec.ts`,
`test/importacion-contable.e2e-spec.ts`, incluyen los casos cross-organización y de idempotencia
por reintento).

**`GET /contratos` (2026-08-14, para Fase 5/WEB)**: `ContratoController`
(`src/entitlements/contrato.controller.ts`) — lectura abierta (`ServiceTokenGuard` a secas, sin
exigir el rol de escritura, DOC-012 §4), devuelve `ContratoRepository.findAll()`. Faltaba: hasta
ahora `Contrato` solo se leía indirecto vía `GET /entitlements` (que no expone `id`/`estado`),
insuficiente para que un cliente (WEB) supiera qué `id` mandarle a `PATCH /contratos/:id`.

**`GET /inventarios` + `GET /inventarios/:id` (2026-08-14, para Fase 5/WEB, RF-04)**:
`InventariosController.getInventarios`/`getInventarioDetalle` +
`SesionInventarioRepository.findByOrganizacion`/`findDetalle` — listado de sesiones por
organización y detalle con sus escaneos. Mismo motivo que `GET /contratos`: `GET
/inventarios/:id/estado` (Fase 2/3) ya existía pero exige conocer el `id` de antemano, sin forma
de listar qué sesiones existen. Ambos endpoints nuevos usan pipes por parámetro
(`@Param(new ZodValidationPipe(...))`), no `@UsePipes()` de método — ver `cis/README.md` § Fase 5
para el hallazgo real que motivó ese cuidado.

**`GET /auditoria` (2026-08-14, para Fase 5/WEB, RF-06)**: `AuditoriaController`
(`src/auditoria/`) — primer consumidor real del Motor de Auditoría (DOC-011 lo dejaba
explícitamente sin controller, "sin consumidor"). `AuditoriaRepository.listar()` devuelve hasta
200 entradas, más recientes primero. Lectura abierta, mismo criterio que `GET /contratos`: la
tabla `auditoria` no tiene `organizacionId` (DOC-005 §7, audita cualquier operación del
ecosistema, no solo las de una organización), así que no hay forma de exigir el rol contra una
organización específica todavía — limitación conocida, documentada, no bloqueante para este
incremento (mismo volumen bajo que justificó diferir el filtro por organización en
`GET /contratos`).

**Filtros de `GET /auditoria` (2026-08-14, cierra RF-06)**: `AuditoriaRepository.listar` acepta
`usuario`/`operacion` (`ILIKE '%valor%'`, búsqueda parcial — `operacion` incluye el id del recurso
en varias operaciones, ej. `POST /activos/{id}/baja`, `PATCH /responsables/{id}/estado`, un filtro
exacto casi nunca matchearía) y `fechaDesde`/`fechaHasta` (rango inclusive sobre la columna
`timestamptz`). Condiciones dinámicas parametrizadas, mismo patrón que
`ActivoRepository.findCatalogo`. El requisito original (`web/aidlc-docs/requirements/`) pedía
auditoría "filtrable por usuario/fecha/operación" — el primer incremento solo devolvía el listado
sin filtro alguno; este cierra ese gap.

**Módulo `src/estructura/` — Área/Ubicación/Responsable (2026-08-14, para Fase 5/WEB, RF-05)**:
último módulo del MVP de WEB, el único sin ningún endpoint previo. `AreaRepository`/
`UbicacionRepository`/`ResponsableRepository` (lectura: `GET /areas?organizacionId=`,
`GET /ubicaciones?sedeId=`, `GET /responsables?areaId=`, todas lectura abierta) +
`EscrituraEstructuraService` (alta de las tres, más `PATCH /responsables/:id/estado` — la "baja"
de un Responsable, nunca un DELETE, Tomo III §4.10) invocado desde `OrquestadorService` con el
mismo patrón de autorización+auditoría que Activo/Contrato (DOC-012). `Ubicacion` y `Responsable`
no tienen columna `organizacionId` propia (`sede_id`/`area_id` respectivamente, DOC-005 §2) — la
escritura cruza esas referencias contra `organizacionId` con una consulta previa
(`verificarPertenece`/`verificarAreaPerteneceOrganizacion`) antes de insertar, defensa en
profundidad mismo criterio que `ActivoRepository` con activos de otra organización (una FK de
Postgres por sí sola no distingue una sede/área real pero de otra organización).

**Edición de Área/Ubicación (2026-08-14, cierra RF-05)**: `AreaRepository.actualizar` y
`UbicacionRepository.actualizar` (`PATCH /areas/:id`, `PATCH /ubicaciones/:id`) — mismo criterio
que `ActivoRepository.cambiarEstado`: si el recurso no existe o es de otra organización, 404 (no
403 ni 400), sin confirmar si el id existe en otra organización. La edición de Área incluye
`responsableId`/`ubicacionPrincipalId` (validados cross-organización antes de escribir, igual que
las referencias del alta) — cierra el ciclo que DOC-005 §2 documentaba como "sin ciclo estricto de
creación": esa nota explicaba por qué el alta no exige esos dos campos, no por qué la asignación
posterior no se podía hacer nunca. Sin `sedeId` editable en Ubicación — mover de sede es un
traslado, operación distinta y más grande, mismo motivo por el que el traslado de Activo sigue sin
controller HTTP en el Motor Patrimonial (DOC-008, YAGNI, sin consumidor real).

## Desarrollo local
Requiere una base `core` real con las migraciones de [`migrations/`](migrations) aplicadas —
`docker compose up -d` desde `../devops/local` ya lo hace solo (el servicio `core-migrate` corre
`npm run migrate:up` una vez, antes de levantar `core`; `postgres` solo crea la base/usuario
vacíos, ver `devops/local/postgres/init/02-core.sh`). Fuera de Docker, aplicar a mano:
```bash
cd core
npm install
npm run migrate:up    # requiere CORE_DB_HOST/PORT/NAME/USER/PASSWORD en el entorno
```
`test:e2e` (y `start:dev`) leen la misma conexión de
`CORE_DB_HOST`/`CORE_DB_PORT`/`CORE_DB_NAME`/`CORE_DB_USER`/`CORE_DB_PASSWORD` — ver
`src/database/database.config.ts` y los defaults de `test/jest-e2e.setup.ts` (apuntan a
`localhost:5432`, que el compose ya expone al host).
```bash
cd core
npm install
npm run start:dev     # http://localhost:3001 y http://localhost:3001/health
npm run lint
npm run test:cov
npm run test:e2e      # requiere la base `core` real, ver arriba
npm run build
```
Puerto por defecto `3001` (no `3000`) para poder correr `cis` y `core` en paralelo fuera de
Docker sin chocar — dentro de Docker Compose cada uno tiene su propio namespace de puertos, así
que no sería estrictamente necesario, pero evita sorpresas en desarrollo local sin contenedores.

## Responsabilidades exclusivas (Tomo IV §2.3)
Ningún componente externo puede ejecutar estas operaciones directamente: crear/modificar/dar de
baja activos, autorizar traslados, validar inventarios, registrar movimientos, asignar
responsables, asociar etiquetas QR/RFID, administrar estados patrimoniales, actualizar
historial, registrar eventos, actualizar indicadores, generar alertas, publicar información.

## Arquitectura interna: Orquestador + 9 motores (Tomo IV §2.4–2.14)
Ver también [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §1 — en el MVP estos 9 motores son
módulos internos de un mismo desplegable, no microservicios separados; se separan solo cuando
uno necesite escalar de forma independiente.

- **Orquestador Central**: recibe toda operación (ya autenticada/validada por CIS), identifica
  origen, determina motores involucrados, controla secuencia, publica eventos, cierra
  transacción. Toda operación pasa primero por acá.
- **Motor Patrimonial**: ciclo de vida completo del activo — alta, modificación, traslado, cambio
  de responsable/ubicación/estado, inventario, baja, reincorporación, consulta. Entradas: QR,
  WEB, RFID, ERP, Administrador. Salidas: Base Patrimonial, Historial, Eventos, Indicadores,
  Alertas. Consulta/inventario ya del MVP (Fase 2); alta/baja/reincorporación/cambio de
  responsable ya implementados (Fase 4, DOC-012 — ver "Estado"); cambio de ubicación/traslado
  siguen sin endpoint HTTP propio, sin consumidor real todavía (DOC-008).
- **Motor de Reglas**: valida invariantes antes de confirmar cualquier transacción — un activo no
  puede tener dos responsables vigentes, una etiqueta QR solo puede estar en un activo, un RFID
  no se repite, un traslado requiere autorización según perfil, un inventario no cierra con
  pendientes sin incidencia registrada. Las 8 categorías de resultado de escaneo de APP QR
  (correcto, otra área, otra ubicación, no registrado, código inválido, duplicado, ya escaneado,
  con incidencia) se resuelven acá, no en la app de captura.
- **Motor de Eventos**: registra todo hecho significativo (alta, lectura QR/RFID, traslado,
  inventario, movimiento, incidencia, mantenimiento, integración, actualización) — genera el
  historial operacional del patrimonio.
- **Motor de Auditoría**: registra usuario, fecha, hora, operación, resultado, equipo, dirección
  IP y tiempo de ejecución de toda acción del sistema — garantiza trazabilidad total.
- **Motor de Alertas**: detecta movimiento no autorizado, inventario pendiente, activo no
  localizado, documento vencido, RFID fuera de zona, inconsistencias, errores de integración.
  Salidas: dashboard, correo, aplicación móvil, portal.
- **Motor de Reportes**: construye inventarios, auditorías, movimientos, altas, bajas,
  indicadores, incidencias, RFID, QR — en PDF, Excel, CSV, JSON.
- **Gestión Documental**: expediente digital único por activo (facturas, garantías, contratos,
  fotografías, manuales, actas, certificados, informes).
- **Gestión de Usuarios**: crear, modificar, desactivar, asignar roles/áreas, controlar sesiones,
  registrar accesos.
- **Gestión de Permisos**: consultar, crear, modificar, eliminar, autorizar, exportar,
  administrar, configurar — bajo el principio de permisos mínimos necesarios (coordina con
  `../seguridad`).

## Flujo/ciclo de vida de una transacción (Tomo IV §2.15–2.16)
`Solicitud → Orquestador → Autenticación → Autorización → Motor de Reglas → Motor Patrimonial →
Base Patrimonial Central → Motor de Eventos → Motor de Auditoría → Motor de Alertas (si aplica) →
CIP → Respuesta`. Estados: Recibida → Validada → Autorizada → Procesada → Persistida → Auditada →
Publicada → Finalizada. Si una validación falla, la transacción se cancela de forma controlada,
registrando el motivo.

## Depende de
- Modelo de dominio y esquema de Base Patrimonial Central (`../base-patrimonial`) — a diseñar en
  conjunto, no por separado. `Contrato` ya está modelado
  ([DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md)); el alcance mínimo del resto
  también ([DOC-005](../base-patrimonial/DOC-005-modelo-patrimonial.md)) — `Configuración` e
  `Integraciones` siguen pendientes, sin consumidor todavía.
- Decisión de identidad/auth (afecta también a CIS y `../seguridad`) — ya resuelta a nivel de
  mecanismo (Zitadel/OIDC, ver [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md)), CIS
  ya la implementa. CORE no valida tokens de operador directamente (eso ya lo hace CIS antes de
  reenviar la request) — sí valida que quien le habla sea CIS, vía secreto compartido
  (`ServiceTokenGuard`, ver "Estado"). Deliberadamente no usa Zitadel: CORE nunca necesita
  identidad de operador, solo confianza de que el llamador es CIS.

## Bloquea
- Nada de CIS ya — `auth/session` consume `GET /entitlements` real (ver
  `cis/src/core-client/`).
- Portal WEB y CIP (consumen datos que produce el CORE) — todavía sin código.

## Documentos relacionados
[ADR-001](../adr/ADR-001-stack-backend-nestjs.md) (stack: NestJS/TypeScript — los 9 motores son
módulos Nest dentro de un mismo desplegable, ver ADR-001).
[`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md)
(modelo de `Contrato` — primer dato real que este esqueleto tendría que servir).
[`base-patrimonial/DOC-005-modelo-patrimonial.md`](../base-patrimonial/DOC-005-modelo-patrimonial.md)
(alcance mínimo del resto del dominio — Área/Ubicación/Responsable/Catálogo/Activo/Inventarios/
Eventos/Auditoría). [`aidlc-docs/`](aidlc-docs/00_PROJECT_METADATA.md) — DOC-006 (API CIS↔CORE),
DOC-007 (Orquestador), DOC-008 (Motor Patrimonial), DOC-009 (Motor de Reglas), DOC-010 (Motor de
Eventos), DOC-011 (Motor de Auditoría), todos entregados e implementados. Pendiente: DOC-003
Modelo de dominio SICSAFT completo.
[`seguridad/DOC-012-administrador-patrimonial.md`](../seguridad/DOC-012-administrador-patrimonial.md)
— diseño del rol Administrador Patrimonial (Fase 4), completo: items 1/3/4/5 implementados en
este mismo `core/` (`src/patrimonial/activo-escritura.controller.ts`,
`src/patrimonial/importacion-contable.controller.ts`,
`src/entitlements/contrato-escritura.controller.ts`, `src/orquestador/orquestador.service.ts`).
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) para el marco de escalabilidad/resiliencia
aplicable a este sistema.

## Próximo paso sugerido
`GET /entitlements`, `GET /catalogo`, `GET /contratos`, `POST /inventarios` (Fase 2/3/5) y los 7
endpoints de escritura oficial de DOC-012 (`Activo` alta/baja/reincorporación/responsable,
importación masiva, `Contrato` alta/actualización de estado) ya están hechos y probados de punta a
punta contra Postgres real, incluido desde WEB vía CIS (`ROADMAP.md` Fase 5) — TASK-007 de APP QR
también se verificó real (`ROADMAP.md` Fase 3). Fase 4 queda completa a nivel de código; solo
faltan las 4 acciones de Gestión de Permisos sin consumidor (Autorizar/Exportar/Administrar/
Configurar, DOC-012 §9) que WEB va a necesitar para su propio ABM. El siguiente incremento con
valor real es el módulo Inventarios de WEB (`GET /inventarios/:id/estado` ya existe, falta la
pantalla) o Áreas/Ubicaciones/Responsables (RF-05), que sí requiere endpoints de escritura nuevos
en CORE. Alternativa sin código: rotación/gestión del `CORE_SERVICE_TOKEN` vía un secret manager
en vez de una env var plana cuando se pase a producción (ver `../devops/README.md`). Tarjeta
Trello: `CORE-ADR-001`.

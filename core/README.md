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

**Fase 4 (Administrador Patrimonial) — items 1 y 3 ya implementados**: diseño completo en
[`seguridad/DOC-012-administrador-patrimonial.md`](../seguridad/DOC-012-administrador-patrimonial.md).
El Motor Patrimonial ya cubre el resto del ciclo de vida de `Activo` que DOC-008 dejaba para esta
fase: `POST /activos` (alta), `POST /activos/:id/baja`, `POST /activos/:id/reincorporacion`,
`PATCH /activos/:id/responsable` (`src/patrimonial/activo-escritura.controller.ts` +
`escritura-activo.service.ts`), todos detrás de `ServiceTokenGuard` con la autorización de rol
(`administrador-patrimonial`, verificada **por organización** — no solo "¿tiene el rol en algún
lado?") resuelta dentro de `OrquestadorService` para que un 403 por falta de rol también quede
auditado. `ActivoRepository` cruza la organización del payload contra la organización real del
activo objetivo antes de escribir (defensa en profundidad, 404 si no coincide) — corrige un
hallazgo real de revisión de seguridad encontrado durante este mismo incremento. Verificado con
unit + e2e reales contra Postgres (`test/activo-escritura.e2e-spec.ts`, incluye el caso
cross-organización). Pendiente de Fase 4: importación masiva de base contable y escritura de
`Contrato` (items 4 y 5 de DOC-012).

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
— diseño del rol Administrador Patrimonial (Fase 4), items 1 y 3 ya implementados en este mismo
`core/` (`src/patrimonial/activo-escritura.controller.ts`, `src/orquestador/orquestador.service.ts`).
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) para el marco de escalabilidad/resiliencia
aplicable a este sistema.

## Próximo paso sugerido
`GET /entitlements`, `GET /catalogo`, `POST /inventarios` (Fase 2/3) y los 4 endpoints de
escritura oficial de `Activo` (Fase 4, DOC-012 items 1/3) ya están hechos y probados de punta a
punta — TASK-007 de APP QR también se verificó real (`ROADMAP.md` Fase 3). El siguiente
incremento con valor real dentro de esta misma fase es DOC-012 item 4 (importación masiva de
base contable, precursor manual de CON-CONTABILIDAD) o item 5 (escritura de `Contrato`, hoy solo
se lee) — cualquiera de los dos requiere diseño mínimo adicional (formato exacto de fila de
importación, transiciones válidas de `Contrato`) antes de código. Alternativa sin código:
rotación/gestión del `CORE_SERVICE_TOKEN` vía un secret manager en vez de una env var plana
cuando se pase a producción (ver `../devops/README.md`). Tarjeta Trello: `CORE-ADR-001`.

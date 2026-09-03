# CIS — Centro de Interoperabilidad SICSAFT (SYS-02)

## Objetivo
Punto único de entrada entre las fuentes de captura (APP QR, WEB, RFID, ERP, etc.) y SICSAFT CORE.
Responsable de autenticación, validación estructural, identificación del origen, correlación de
transacciones y despacho hacia el CORE. Ninguna fuente de captura debe hablarle directo a la
Base Patrimonial Central ni al CORE — todo pasa por acá.

## Estado
🟢 Esqueleto NestJS + **Conector QR real, proxy delgado hacia CORE** (contrato DOC-002, resuelto
contra DOC-006 2-4) + **auth real vía Keycloak** ([ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md),
reemplaza a ADR-002) + **circuit breaker propio** (WAF 4):
los 4 endpoints exigen `Authorization: Bearer <token>` y `KeycloakAuthGuard` valida
firma/issuer/audience/vencimiento contra el JWKS de Keycloak — el CIS ya no acepta
`operadorId`/`credencial` en el body, la identidad viene del token. `QrConnectorService` ya no
mantiene estado propio (sin `Map` en memoria, sin seed): las 4 operaciones —
`getEntitlements`/`getCatalogo`/`postInventario`/`getInventarioEstado` — son pass-through hacia
`CoreClientService`, que valida cada respuesta con Zod en el límite (CORE es un proceso/red
distinto, no se asume su forma) y devuelve 502 ante cualquier falla (red, timeout, 5xx, secreto
inválido, forma inesperada) — nunca datos a medias. `CoreClientService` manda el secreto
compartido de auth servicio-a-servicio (`x-internal-service-token`, ver `../core/README.md`) —
CORE ya no acepta llamadas sin él. Todo llamado a CORE pasa primero por reintentos con backoff
exponencial (`src/core-client/retry.ts`, WAF 4: "reintentos con backoff exponencial + límite de
intentos, nunca reintento inmediato en bucle") y luego por un `CircuitBreaker` propio
(`src/core-client/circuit-breaker.ts`): 3 intentos totales (200ms/400ms de backoff) solo para
fallos transitorios — sin respuesta o 5xx, nunca un 400/404/409 (rechazo permanente, DOC-002 5);
si los 3 intentos fallan, cuenta como **un** fallo para el circuito, que abre a los 5 consecutivos
y sondea de nuevo (half-open) a los 30s — mientras está abierto, `CoreClientService` devuelve 502
sin ni siquiera intentar la llamada HTTP. Reintentar es seguro para las 4 operaciones, incluido
`POST /inventarios`: CORE dedupea por `idempotencyKey` (DOC-006 3), reintentar una request ya
aceptada devuelve la misma fila, nunca duplica. Idempotencia de inventarios (DOC-002 4/5),
validación de organización/área/ubicación y clasificación de escaneos ya no viven en CIS — se
resolvieron en CORE (`sesiones_inventario`, Motor de Reglas, Fase 2 de ROADMAP.md); CIS solo
propaga el 400/409 que CORE produce.
Probado de punta a punta: lint, unit (100% stmts/lines/funcs, 90%+ branches, incluye reintentos
con fake timers), e2e (incluye los casos 502/400/404/409, con `CoreClientService` stubeado — no se
levanta un CORE real), build. Conectividad real entre contenedores `cis`↔`core` verificada con
`docker network` + `docker exec` para `GET /entitlements` (incluidos los 3 casos del secreto: sin
header, correcto, incorrecto); queda pendiente repetir esa verificación de punta a punta contra
Docker real para catálogo/inventarios (el mecanismo es el mismo `CoreClientService`, ya probado,
pero no se corrió ese `docker exec` específico todavía). Toda ruta pasa por
`CorrelationIdMiddleware` (`src/common/correlation-id/`, ROADMAP.md Fase 0), que propaga
`X-Correlation-Id` hasta `CoreClientService` — sin logging estructurado que lo use todavía (WAF
2, pendiente). Los 4 endpoints también están detrás de `RateLimitGuard`
(`src/rate-limit/`, WAF 4 "rate limiting hacia el CORE"), por operador: 30 requests cada 10s
respaldado en memoria del propio proceso (`InMemoryRateLimiter`, ventana fija — mismo algoritmo que
el script Lua `INCR`+`PEXPIRE` que usaba antes contra Redis). **ADR-005 (2026-08-27)**: reemplaza a
Redis en todo el ecosistema (ver también `core/README.md`/`cip/README.md`) — `cis/` no tiene
Postgres propio y corre como instancia única en los 3 perfiles de `devops/` hoy, así que no hace
falta un backend compartido entre procesos para esto (excepción documentada a "multi-instancia sin
estado en memoria compartido" de WAF 4, ver `ARQUITECTURA-WAF.md`). Sin backend externo no hay
error de red que gestionar — el "falla abierto" que exigía WAF 4 (dejar pasar la request antes que
bloquear el flujo real Captura→CIS→CORE por una caída de un componente de protección secundario)
queda automáticamente satisfecho.
`auth/session` también registra en memoria el `deviceId` de la request como dispositivo activo del
operador (`src/device-registry/`, DOC-002 1 "un solo dispositivo por operador"): un dispositivo
nuevo **reemplaza** al anterior (nunca se rechaza) — no existe todavía un rol Administrador
(ROADMAP.md Fase 4) para destrabar manualmente a un operador, así que rechazar dejaría varado a
cualquiera que pierda o cambie de celular; el registro expira solo (timer en memoria), con el mismo
TTL que le queda al token, sin requerir logout explícito. Es una restricción de negocio
complementaria, no un control de seguridad (Keycloak ya autentica) — perder este estado en un
reinicio del proceso ya era aceptable con Redis, que tampoco persistía en disco por defecto acá. El
enforcement es parcial por diseño del contrato:
`deviceId` solo llega en el body de `auth/session`, DOC-002 no lo manda en las otras 3 rutas — no
hay forma de revalidar el dispositivo en cada request sin romper ese contrato ya acordado con
APP QR.
CORS habilitado (`app.enableCors`, `src/main.ts`) vía `CIS_CORS_ORIGIN` (opcional, sin default) —
primera vez que un navegador (`app-qr-sicsaft/`, TASK-007) le habla directo a CIS, no solo
llamadas servicio-a-servicio; `app-qr-sicsaft` ya tiene un cliente HTTP real
(`HttpQrConnectorClient`) contra los 4 endpoints, pendiente de verificar en vivo (falta crear la
app OIDC/el client público en Keycloak, ver `../devops/local/README.md`).

**ADR-004 Fase 1 (2026-08-26) — Keycloak reemplaza a Zitadel en la identidad de CIS**: reescribe
`src/common/auth/` (`ZitadelAuthGuard` → `KeycloakAuthGuard`) y `src/zitadel-admin/` →
`src/keycloak-admin/` contra la Admin REST API de Keycloak, verificada en vivo contra un Keycloak
26.6 de prueba antes de escribir el código (no asumida de la documentación). Elimina la capa de
traducción de ids (`organizacion-mapping.config.ts`/`OrganizacionMappingDinamicoService`,
`ZITADEL_ORG_ID_MAP`): con Keycloak, el `organizacionId` que usa el resto del ecosistema es el
mismo alias de la Organization que ya firma el JWT, sin mapeo externo de por medio. Hallazgo real que
cambia el diseño respecto al ADR: los realm roles de Keycloak son globales por usuario, no
anidados por organización como el claim propietario de Zitadel — `KeycloakAuthGuard` resuelve
`rolesPorOrganizacion` llamando a `KeycloakAdminService` (grupos `{organizacionId}::{rol}`, con
caché corta de 30s en memoria del propio proceso) en vez de leerlo directo del token. Alcance de
esta fase: solo `cis/`. Los 3 portales (`app-qr-sicsaft/`, `ccp/`, `core/frontend/`)
y los 3 stacks de `devops/` siguen apuntando a Zitadel hasta que se ejecuten las fases siguientes
(ver [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) "Consequences") — hasta
entonces, `cis/` no tiene un Keycloak real contra el cual autenticar en `devops/local/`.

**Fase 5 (Portal WEB) — `AdministradorModule` nuevo**: `POST /admin/activos`
(`src/administrador/`) es el puente real WEB→CIS→CORE para la escritura oficial de `Activo`
(DOC-012 5) — mismos guards que el Conector QR (`ZitadelAuthGuard` + `RateLimitGuard`).
`AdministradorService` traduce `rolesPorOrganizacion` (que Zitadel firma con SU id de
organización, ej. `386029528616558597`) al `organizacionId` de texto que CORE entiende (`duoc-uc`)
usando un mapeo explícito por env (`ZITADEL_ORG_ID_MAP`, `src/administrador/
organizacion-mapping.config.ts`) — sin este mapeo, un token real de Zitadel nunca podría autorizar
una escritura oficial, porque `verificarRolAdministradorPatrimonial` en CORE compara contra su
propio id, que nunca coincide con la clave que Zitadel firma (mismo gap que DOC-004 7, resuelto
acá solo para el camino de escritura). `CoreClientService.postActivo` extiende el cliente de CORE
existente, propagando también un 403 (además de 400/409) para que WEB pueda distinguir "sin
permiso" de "CORE caído" (DOC-012 8). **Verificado real de punta a punta el 2026-08-14**: rol
`administrador-patrimonial` creado en Zitadel (proyecto "CIS", org "DUOC UC"), usuario de prueba
con ese rol, login OIDC/PKCE real desde `ccp/` → JWT real con el claim de rol → CIS lo valida y
traduce → CORE crea el activo en Postgres → visible de inmediato en `GET /catalogo` (mismo
catálogo que consume APP QR, confirma WAF 8). Detalle completo en
`../devops/local/README.md` "Cliente OIDC real (WEB)".

**Extensión a Contrato (2026-08-14)**: mismo módulo, `GET/POST /admin/contratos` y
`PATCH /admin/contratos/:id` — puente hacia `GET/POST /contratos` y `PATCH /contratos/:id` de
CORE (DOC-012 7; `GET /contratos` en CORE también es nuevo, ver `../core/README.md`). Lectura
(`getContratos`) no traduce `rolesPorOrganizacion` — CORE no exige el rol para leer (DOC-012 4).
Dos bugs reales encontrados probando el flujo completo desde el navegador, no en tests
unitarios/e2e con mocks: (1) CORS de `src/main.ts` solo permitía `GET`/`POST`, el navegador
bloqueaba el `PATCH` en el preflight — se agregó `PATCH` a `methods`; (2)
`actualizarEstadoContrato` usaba `@UsePipes()` a nivel de método, que Nest aplica a **todos** los
parámetros del handler — validaba `@Param('id')` (un string) contra un schema que esperaba un
objeto, rompiendo con "Payload inválido" en cualquier request real. Corregido a un pipe por
parámetro (`@Body(new ZodValidationPipe(...))`, mismo patrón que ya usaban los endpoints de
escritura de Activo en CORE) y cubierto con `test/administrador.e2e-spec.ts` (JWT real firmado,
guard real, `CoreClientService` stubeado) para que este tipo de bug de wiring HTTP no vuelva a
pasar desapercibido en un spec unitario que llama al método directo.

**Extensión a Inventarios — listado y detalle (2026-08-14)**: `QrConnectorController` (no
`AdministradorModule` — lectura abierta, sin rol) suma `GET /inventarios` y `GET /inventarios/:id`
como puente hacia el mismo par de endpoints nuevos en CORE (`GET /inventarios/:id/estado` ya
existía desde Fase 3, pero exigía conocer el `id` de antemano; sin listado no había forma de que
WEB mostrara qué sesiones existen). Aplicado el pipe-por-parámetro desde el vamos (el hallazgo de
`@UsePipes()` de método de más arriba), sin repetir el bug.

**`GET /inventarios/:id/control` — informe de control de área ("Pantalla 8", DOC-029 RF-I,
mergeado)**: passthrough delgado en el mismo `QrConnectorController` (sirve al CCP y a la
APP QR — la lectura del detalle de sesión ya es abierta a cualquier operador autenticado, no hace
falta una ruta `/admin/...` aparte). `core-client` gana el schema Zod espejo + `getInventarioResumenControl`;
`qr-connector` el proxy. La agregación (%, desglose por estado declarado, tipo ordinario/
extraordinario, veredicto) la hace CORE — CIS no reinterpreta nada. Ver `../core/README.md`.

**`GET /admin/auditoria` (2026-08-14, RF-06 — filtros agregados el mismo día)**:
`AdministradorController`/`AdministradorService` suman un puente hacia `GET /auditoria` de CORE
(mismo criterio que `getContratos`: lectura abierta, no traduce `rolesPorOrganizacion`), incluidos
los filtros `usuario`/`operacion`/`fechaDesde`/`fechaHasta` como query params (pasan tal cual a
CORE, que hace la búsqueda parcial/rango real — CIS no reinterpreta ninguno). Sin filtro por
organización — la tabla `auditoria` de CORE no tiene ese dato todavía (ver `../core/README.md`).
DOC-029 RF-E (mergeado) suma el query param `?area=` (passthrough más, `ILIKE`
parcial en CORE) y el campo `areaOperativa` en cada entrada de la respuesta — `auditoriaEntradaSchema`
y `auditoriaQuerySchema` lo reflejan.

**Área/Ubicación/Responsable (2026-08-14, RF-05 — cerrado el mismo día)**:
`AdministradorController`/`AdministradorService` suman `GET/POST/PATCH /admin/areas`,
`GET/POST/PATCH /admin/ubicaciones`, `GET/POST /admin/responsables` y
`PATCH /admin/responsables/:id/estado` — mismo puente que Activos/Contratos (traduce
`rolesPorOrganizacion` de Zitadel a `organizacionId` de CORE antes de las escrituras, lecturas
abiertas). Los dos `PATCH` de edición (Área/Ubicación) validan con `@Body(new
ZodValidationPipe(...))` por parámetro, no `@UsePipes()` de método — mismo cuidado preventivo que
ya se aplicó a Inventarios tras el hallazgo real en `actualizarEstadoContrato`. Último módulo del
MVP de WEB en tener endpoint — ver `../core/README.md` `src/estructura/` para el detalle de la
escritura oficial nueva en CORE.

**Paginación en `getContratos`/`getAuditoria`/`getAreas`/`getUbicaciones`/`getResponsables`
(2026-08-14, cierra RNF-01)**: CORE dejó de devolver array plano en estos 5 endpoints (ver
`../core/README.md`) — `CoreClientService` y `AdministradorController`/`AdministradorService`
propagan `limit`/`offset` end-to-end (`administrador.schemas.ts` agrega un fragmento
`paginacionSchema` compartido, mismo patrón que `core/src/estructura/estructura.schemas.ts`) y
devuelven el envelope `{ <entidad>, total }` tal cual, sin reinterpretarlo.

**Cierre de 5 gaps del CCP + rol Administrador del Sistema (2026-08-18,
[DOC-021](../aidlc-docs/ccp/design-artifacts/DOC-021-cobertura-ccp-y-administrador-sistema.md))**:

> **Eliminado (2026-09).** El portal `web_admin/` y el rol `administrador-sistema` se retiraron por
> completo. `AdministradorModule` conserva **solo las rutas `/admin/*` del CCP** (Activo:
> `POST`/baja/reincorporación/`PATCH responsable`/`descripcion`; `GET/POST /admin/catalogo-tipos`;
> `GET/POST/DELETE /admin/activos/:id/documentos`; `POST /admin/importaciones/contable` + la
> bandeja de staging `/lote*`; `GET /admin/auditoria`; `/admin/areas|ubicaciones|responsables*`).
> Se borraron las rutas `/admin/organizaciones*` (+ `/:orgId/usuarios*`), `/admin/contratos*`,
> `/admin/sedes*` e `/admin/indicadores`, más `AdministradorSistemaGuard` y
> `AdministradorSistemaEnCualquierOrganizacionGuard`. El CRUD de Organización/Contrato/Sede y la
> asignación de usuarios pasó a intervención directa del proveedor externo (BD / script con
> service-token) + el bootstrap del wizard de `sicsaft-core`; los errores se diagnostican por la
> consola de logs de `sicsaft-core`. El resto de este bloque queda como registro histórico de
> cómo se construyó el módulo.

`AdministradorController`/`AdministradorService` suman ~15 endpoints nuevos, mismo patrón puente
que el resto del módulo — `POST/baja/reincorporacion/PATCH responsable/descripcion` de Activo,
`GET/POST /admin/catalogo-tipos`, `GET/POST/DELETE /admin/activos/:id/documentos`,
`POST /admin/importaciones/contable`, `GET/POST /admin/organizaciones`, `GET /admin/indicadores`.
Puente de la **bandeja de staging** de la ingesta de Excel supervisada (DOC-029 RF-B):
`POST /admin/importaciones/contable/lote`, `GET /admin/importaciones/contable/lote[?estado]` +
`/lote/:id`, `POST /lote/:id/aprobar` y `/lote/:id/rechazar` — crear/aprobar/rechazar inyectan la
identidad del JWT (CORE verifica el rol y audita), listar/obtener requieren sesión válida y acotan
por `organizacionId`.
Módulo nuevo `src/zitadel-admin/` (mismo esqueleto que `core-client`/`cip-client`: config, circuit
breaker, reintentos) — integración real con la API de administración de Zitadel
(`ZitadelAdminService.buscarUsuarioPorEmail`/`listarGrants`/`crearGrant`, autenticada con un
Personal Access Token de un service user, header `x-zitadel-orgid` para escribir en
organizaciones distintas a la del service user) para `GET/POST /admin/organizaciones/:orgId/
usuarios`. **Verificado real contra Zitadel v2.65 recién en DOC-022 4 (2026-08-19)** — dos bugs
reales encontrados ahí, no solo contra la documentación pública (ver el comentario completo en
`zitadel-admin.types.ts`/`zitadel-admin.service.ts`): (1) `listarGrants` mandaba un `orgIdQuery`
que la API real rechaza con 400 (ese query type no existe — Zitadel solo filtra grants por
dominio/nombre de organización, no por id), corregido a pedir por proyecto solamente y filtrar
por `orgId` en memoria con la respuesta; (2) `crearGrant` fallaba con 409 "already exists" cuando
el usuario YA tenía cualquier grant en el proyecto CIS (Zitadel modela un solo `UserGrant` por
usuario+proyecto+organización, con `roleKeys` como array) — corregido a detectar el 409 y sumar
el rol al grant existente vía `PUT` en vez de intentar crear uno nuevo. Ambos bugs afectaban
también a `web_admin/` (mismo `ZitadelAdminService`, verificado real tras el fix: alta de
organización, listado de usuarios por organización y asignación de un rol adicional a un usuario
ya asignado, los tres reales contra el stack de Docker). `AdministradorSistemaGuard`
(`src/administrador/administrador-sistema.guard.ts`) es el único endpoint de este módulo que NO
sigue el patrón "verificar dentro del Orquestador de CORE" — un guard normal de CIS alcanza
porque asignar usuarios en Zitadel no toca CORE ni el Motor de Auditoría de Tomo IV (WAF 3 sigue
aplicando: CORE re-verifica el rol para todo lo que sí escribe BPI). Bug real encontrado con el
nuevo e2e (`test/gaps-ccp-admin-sistema.e2e-spec.ts`, no en unit con mocks): `POST /admin/
organizaciones/:orgId/usuarios` usaba `@UsePipes()` de método — mismo hallazgo ya documentado
arriba para `actualizarEstadoContrato`, corregido al mismo patrón de pipe por parámetro.

**Umbral de cobertura de branches en 84%, no 85% (DOC-021, 2026-08-18)**: `AdministradorController`
sumó 30 endpoints nuevos (gaps del CCP + Administrador del Sistema); cada firma de método
multilínea con decoradores (`@Body()`/`@Param()`/`@Req()`) genera una rama `cond-expr` marcada
"no cubierta" por `istanbul-lib-instrument` que no corresponde a ninguna lógica condicional real
del código compilado (verificado comparando la salida de `tsc` para el mismo archivo — sin
ternarios) — mismo patrón preexistente en `qr-connector.controller.ts`/
`dashboard-connector.controller.ts`/`app.controller.ts` (siempre 75% branches ahí), que antes no
bajaba el promedio global por debajo de 85% por tener menos peso relativo. 100% statements/lines/
functions se mantiene sin excepción. Ningún test puede cubrir esa rama fantasma (es metadata de
compilación, no una rama de ejecución dependiente de datos).

**Módulo nuevo `src/directivo/` — gestión de roles acotada a la propia organización
(2026-08-19, [DOC-022](../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
3)**: `GET/POST /directivo/usuarios` — el Directivo designa quién es el Profesional de AFT
(`administrador-patrimonial`) dentro de SU organización, reusando el mismo `ZitadelAdminService`
de `src/zitadel-admin/` que ya usa `AdministradorModule` (Fase 2 de DOC-021), sin ningún cambio
ahí. A diferencia de `AdministradorSistemaGuard` (que lee `:orgId` de la URL porque Administrador
del Sistema opera sobre cualquier organización), `DirectivoGuard`
(`src/directivo/directivo.guard.ts`) nunca acepta un organizacionId de ruta o body — lo deriva
siempre del propio JWT ya validado por `ZitadelAuthGuard`: si el rol `directivo` no aparece en
exactamente una organización del token (cero, o más de una — ambigüedad no resuelta con un
default), rechaza con 403. Esto hace el límite de organización estructural, no solo verificado en
tests: no existe ningún parámetro con el que un Directivo pueda siquiera intentar pedir la
organización de otro. El rol asignable está fijo en el servicio (`administrador-patrimonial`), no
en lo que manda el cliente — `asignarProfesionalAftSchema` ni siquiera tiene un campo `rol` (a
diferencia de `asignarUsuarioOrganizacionSchema` de `AdministradorModule`, que acepta los 3 roles
de Proyecto).

**`GET /admin/indicadores` con guard de rol (2026-08-19,
[DOC-023](../aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md) 3)**: hallazgo real
al construir la matriz de permisos del ecosistema — este endpoint era el único módulo de
administración sin verificación de rol server-side, solo ocultado en la UI de `web_admin/`.
Corregido con `AdministradorSistemaEnCualquierOrganizacionGuard`
(`src/administrador/administrador-sistema-cualquier-organizacion.guard.ts`) — a diferencia de
`AdministradorSistemaGuard`, que chequea el rol contra el `:orgId` de la URL, este endpoint no
tiene organización propia (son indicadores agregados de toda la plataforma), así que el chequeo es
"el rol en cualquier organización del token", mismo criterio que `verificarRolEnCualquierOrganizacion`
de CORE usa para el alta de Organización.

**Limpieza de dependencias muertas (2026-08-19, auditoría con Knip)**: `@eslint/eslintrc`,
`source-map-support` y `ts-loader` salieron de `devDependencies` — ninguno se usaba (`ts-loader`
solo aplica con `webpack: true` en `nest-cli.json`, que este proyecto no tiene; `@eslint/eslintrc`
solo hace falta para `FlatCompat`, que `eslint.config.mjs` no usa). `supertest`/`@types/supertest`
se verificaron en uso real (los 6 `*.e2e-spec.ts` de `test/`) antes de descartarlos como falso
positivo de Knip — se quedan.

**CRUD completo sin Consola de Zitadel + auditoría de identidad (2026-08-21,
[DOC-024](../aidlc-docs/ccp/design-artifacts/DOC-024-crud-completo-auditoria-identidad.md))**:
`ZitadelAdminService` gana `actualizarNombreOrganizacion`, `quitarRolDeGrant` y `desactivarUsuario`
— verificados reales contra el Zitadel de `devops/local` antes de codearlos (mismo criterio que el
resto de este módulo). Hallazgo real: un usuario en `USER_STATE_INITIAL` (cualquier Profesional de
AFT recién creado en este stack sin SMTP) no se puede desactivar, Zitadel exige borrarlo — único
caso donde este servicio borra un usuario de verdad. Nuevo módulo `src/auditoria-identidad/`
(`AuditoriaIdentidadService`, calco de `OrquestadorService.ejecutarOperacionOficial` de CORE):
`asignarUsuarioOrganizacion` y `DirectivoService.asignarProfesionalAft` — las dos únicas
operaciones del ecosistema que nunca tocaban CORE — ahora reportan su resultado a un nuevo
`POST /auditoria` de CORE, cerrando el punto ciego que dejaban fuera del Motor de Auditoría de
Tomo IV. Nuevos endpoints: editar/dar de baja Organización y Sede (`estado`, bidireccional, nunca
`DELETE` real — Tomo III 4.10), `GET /admin/sedes` (picker por organización), editar condiciones
de Contrato (`PATCH /admin/contratos/:id/condiciones`, separado del cambio de `estado` que ya
existía), y quitar/desactivar un usuario de una organización.
**Hallazgo real verificado en vivo contra `web_admin/` en el navegador**: `DELETE` no estaba en la
lista de métodos permitidos de `app.enableCors()` (`src/main.ts`) — el único `DELETE` que existía
hasta ahora (`/admin/activos/:id/documentos/:documentoId`, DOC-021 3) nunca se había ejercitado
desde un navegador real, solo via `supertest`/curl (que no aplican CORS), así que el gap quedó
invisible hasta que la nueva pantalla de "quitar rol" de `web_admin/` lo disparó en vivo — corregido
en el mismo incremento.

**`GET /metrics` protegido con Bearer token (2026-08-24)**: hallazgo real durante el primer deploy
contra Coolify (ver `devops/prod/README.md` "Hallazgo real") — CIS sí tiene router público en
Traefik/Coolify (a diferencia de core/cip), así que `/metrics` quedaba públicamente alcanzable sin
autenticar, un gap ya señalado sin resolver en el comentario original de `PrometheusModule` en
`app.module.ts`. Nuevo módulo `src/common/metrics/` (`MetricsTokenGuard` + `MetricsController`,
que extiende el `PrometheusController` de `@willsoto/nestjs-prometheus` — única forma que expone
la librería para meterle un guard) exige `Authorization: Bearer <METRICS_TOKEN>`, comparación en
tiempo constante como `ServiceTokenGuard` de CORE. `METRICS_TOKEN` es opcional a propósito (a
diferencia de `CORE_SERVICE_TOKEN`/`CIP_SERVICE_TOKEN`): sin configurar, el guard deja pasar todo
y avisa una vez por proceso con `Logger.warn` — el default correcto en `devops/local/` (sin
exposición real que proteger), pero si ese warning aparece en logs de `devops/prod/` es una
brecha real. `MetricsModule` es `@Global()` — `PrometheusModule.register({ controller })` registra
el controller dentro de su propio módulo dinámico, no del nuestro, así que sin `@Global()` Nest no
puede resolver la dependencia del guard (verificado real, no una suposición: falla al arrancar con
"can't resolve dependencies... Symbol(METRICS_CONFIG)... is available in the PrometheusModule
module" sin esto).

## Desarrollo local
```bash
cd cis
npm install
export KEYCLOAK_URL=http://id.sicsaft.localhost      # ver variables requeridas abajo
export KEYCLOAK_REALM=sicsaft
export KEYCLOAK_AUDIENCE=<client-id-de-keycloak>
export KEYCLOAK_ADMIN_CLIENT_ID=<client-confidencial-de-keycloak>
export KEYCLOAK_ADMIN_CLIENT_SECRET=<secreto-del-client-confidencial>
npm run start:dev     # http://localhost:3000 y http://localhost:3000/health
npm run lint
npm run test:cov       # unit tests, ver nota de cobertura abajo
npm run test:e2e
npm run build
```
(No hay un `.env`/dotenv loader todavía — `main.ts` lee `process.env` directo, igual que `PORT`.
Corriendo dentro de `../devops/local/docker-compose.yml` estas variables ya vienen seteadas por
el servicio `cis`, no hace falta exportarlas a mano — **nota**: hasta que `devops/local/` complete
su propia fase de ADR-004, el stack de Docker Compose sigue levantando Zitadel, no Keycloak; estas
variables solo aplican corriendo `cis/` contra un Keycloak levantado aparte.)

**Variables de entorno requeridas** (ver `src/common/auth/keycloak-auth.config.ts` y
`src/keycloak-admin/keycloak-admin.config.ts` — el proceso no arranca sin ellas):
- `KEYCLOAK_URL`: URL base del servidor de Keycloak (ej. `http://keycloak:8080` dentro de la red
  de contenedores, o `https://id.sicsaft.cl` en prod).
- `KEYCLOAK_REALM`: el realm único del ecosistema (`sicsaft`, ver
  [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)) — el `iss` del token se arma
  como `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`.
- `KEYCLOAK_AUDIENCE`: Client ID de la app OIDC del CIS en Keycloak.
- `KEYCLOAK_JWKS_URI` (opcional, default `${issuer}/protocol/openid-connect/certs`): solo hace
  falta sobreescribirla si la URL para *descargar* las llaves deja de ser la misma que el `iss`
  (mismo motivo que antes con Zitadel: el issuer externo no siempre resuelve dentro de la red de
  contenedores/procesos).
- `KEYCLOAK_ADMIN_CLIENT_ID` / `KEYCLOAK_ADMIN_CLIENT_SECRET`: client confidencial con
  `serviceAccountsEnabled` que `KeycloakAdminService` usa para autenticarse contra la Admin REST
  API de Keycloak vía `client_credentials` (reemplaza al PAT estático `ZITADEL_ADMIN_TOKEN` de
  Zitadel — este token expira y se cachea/renueva en runtime, ver `keycloak-admin.service.ts`).
- `CORE_URL`: URL base de SICSAFT CORE (`../core/`), ej. `http://core:3001` dentro de Docker
  Compose. Ver `src/core-client/core-client.config.ts` — el proceso tampoco arranca sin esta.
- `CORE_SERVICE_TOKEN`: secreto compartido de auth servicio-a-servicio hacia CORE — debe ser
  exactamente el mismo valor que `CORE_SERVICE_TOKEN` en el proceso de CORE (ver
  `../core/README.md`). Generar con `openssl rand -hex 32`.
- Sin variable de entorno para `RateLimitGuard`/`DeviceRegistryService` — desde ADR-005
  (2026-08-27) ambos viven en memoria del propio proceso (`InMemoryRateLimiter`,
  `src/device-registry/device-registry.service.ts`), sin backend externo que configurar.
- `CIS_CORS_ORIGIN` (opcional, sin default — CORS deshabilitado si no está seteada): origen(es)
  permitidos separados por coma, ej. `http://localhost:5173`. Necesaria para que un navegador
  (APP QR, TASK-007) le hable directo a CIS — las llamadas servicio-a-servicio (CIS→CORE) no
  pasan por CORS y no la necesitan. Ver `src/main.ts`.

**Nota sobre `coverageThreshold.branches` (85%, no 100%)**: `emitDecoratorMetadata` de TypeScript
emite un chequeo defensivo (`typeof X === "function" ? X : Object`) para cada tipo **importado
como valor** (no `import type`) que se referencia en una firma decorada — una rama de ese chequeo
queda permanentemente inalcanzable en runtime. Confirmado inspeccionando el JS transpilado
directamente, no es una suposición. Dos mitigaciones aplicadas, en orden de efectividad:
1. **`import type` para tipos de solo-firma** (ver `qr-connector.controller.ts`): si el tipo nunca
   se usa como valor en ese archivo, importarlo con `import type` elimina el chequeo por completo
   — TS ya sabe en tiempo de compilación que es imposible que sea una clase real. Subió la
   cobertura de branches del módulo de 53% a 91% con este solo cambio.
2. **Colocar la interfaz en el mismo archivo** que el método decorado (`health.controller.ts`) —
   evita el problema cuando `import type` no aplica porque el tipo se define ahí mismo.
Lo que **no** se puede evitar sin renunciar a la inyección de dependencias: un constructor que
recibe una dependencia real de otro archivo (ej. `AppService` en `AppController`, `QrConnectorService`
en `QrConnectorController`) siempre deja una rama de ese chequeo inalcanzable, porque ahí el tipo
sí debe importarse como valor (se necesita en runtime para inyectarlo). `statements`/`functions`/
`lines` se mantienen en 100% — solo `branches` baja, y solo por esta razón estructural documentada,
recalibrada con el número medido real cada vez que se agrega un módulo grande.

## Conector QR — proxy real hacia CORE (`src/qr-connector/`, `src/common/auth/`)
Contrato completo de
[`../aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-002-conector-qr.md`](../aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-002-conector-qr.md),
resuelto contra CORE vía
[`../aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md`](../aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md).
`QrConnectorService` no tiene lógica de negocio propia — valida con Zod el request de cada
operación (`qr-connector.schemas.ts`) y delega en `CoreClientService`. Los 4 endpoints están
detrás de `KeycloakAuthGuard` (`src/common/auth/keycloak-auth.guard.ts`, sin
`Authorization: Bearer <token>` válido, 401) y luego de `RateLimitGuard`
(`src/rate-limit/rate-limit.guard.ts`, sobre el límite por operador, 429) — el orden importa,
`RateLimitGuard` necesita el `operadorId` que ya dejó `KeycloakAuthGuard` en la request:

```
POST /auth/session                          -> valida el token, devuelve el mismo token (pass-through) + organizaciones/sedes reales via GET {CORE_URL}/entitlements
GET  /catalogo?organizacionId=&areaId=&ubicacionId=  -> catálogo real via GET {CORE_URL}/catalogo
POST /inventarios                            -> proxy a POST {CORE_URL}/inventarios; idempotente por idempotencyKey (DOC-002 4), 400 si la organización no existe, 409 si la key se reutiliza con payload distinto (DOC-002 5) — los tres resueltos por CORE, no por CIS
GET  /inventarios/{id}/estado                -> proxy a GET {CORE_URL}/inventarios/{id}/estado; 404 si no existe
```

**Auth (ADR-002, principio vigente bajo Keycloak vía [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md))**:
`operadorId`/`credencial` ya no van en el body de `auth/session` — Keycloak autentica al operador
(OIDC, fuera del CIS) y el CIS solo valida el access token resultante (firma vía JWKS, `iss`,
`aud`, vencimiento) y lee `operadorId` de su claim `sub`. El CIS no emite un token propio, hace
pass-through del mismo token de Keycloak — coincide con ADR-002: "el punto de validación es el
CIS, no el token" (el JWT no lleva `sedeId`, eso se resuelve en cada request contra CORE, ver
`src/core-client/`).

**`CoreClientService` (`src/core-client/`)**: expone `getEntitlements`/`getCatalogo`/
`postInventario`/`getInventarioEstado`, todas contra `{CORE_URL}` con el header
`x-internal-service-token` (secreto compartido, ver arriba) y validación de la respuesta con Zod
(`core-client.types.ts`). `postInventario` distingue explícitamente 400/409 (rechazo permanente,
DOC-002 5) de cualquier otra falla transitoria (502) — ver `callCore`/`passthroughStatuses` en
`core-client.service.ts`.

**`DeviceRegistryService` (`src/device-registry/`)**: `un solo dispositivo por operador`
(DOC-002 1) enforced en `auth/session` — ver arriba, sección Estado, para el criterio de
supersede-en-vez-de-rechazo y el TTL atado al token.

## Depende de
- Más datos reales de Contrato en `../core/` (hoy solo un caso precargado sobre Postgres, ver
  [DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) 7 — sin mapeo operador→organización
  real todavía).

## Bloquea
- Nada directamente de código. `app-qr-sicsaft/` (TASK-007) ya tiene un cliente HTTP real
  (`HttpQrConnectorClient`) contra estos 4 endpoints, con CORS habilitado acá
  (`CIS_CORS_ORIGIN`) — primera vez que un navegador le habla directo a CIS. Falta la
  verificación en vivo (crear el client OIDC público en Keycloak, recorrido manual), no código de
  CIS — ver `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md` 7. Esa verificación en sí está bloqueada
  hasta que `devops/local/` reemplace Zitadel por Keycloak en el stack de Docker Compose (fase
  siguiente de [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — hoy solo `cis/`
  migró).

## Documentos relacionados
- [DOC-002](../aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-002-conector-qr.md) (contrato
  Conector QR) — vive en el repo de APP QR QRVault por ahora.
- [DOC-006](../aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md) (API CIS↔CORE) —
  implementado en ambos lados.
- [ADR-001](../adr/ADR-001-stack-backend-nestjs.md) (stack: NestJS/TypeScript).
- [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (reemplazada por ADR-004 en el
  proveedor de identidad, principio vigente) — el CIS valida `organizacionId`, `sedeId` y
  vigencia de contrato en cada request, no solo identidad.
- [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — Keycloak self-hosted
  reemplaza a Zitadel; Fase 1 (`cis/`) ya implementada, ver "Estado" arriba.
- [DOC-027](../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md) —
  bitácora de bugs reales de la migración a Keycloak y de `sicsaft-core`. Los que tocaron `cis/`:
  e2e rotos por la Fase 1 (BUG-03), specs de guard firmando dos roles para el mismo `sub`
  (BUG-04), realm roles globales no anidados que forzaron el rediseño de `KeycloakAuthGuard`
  (BUG-02), y `POST /organizations/{id}/members` devolviendo 415 sin `Content-Type` +
  string-body con comillas (BUG-26).
- [`seguridad/DOC-012-administrador-patrimonial.md`](../seguridad/DOC-012-administrador-patrimonial.md)
  — diseño del rol Administrador Patrimonial; `src/administrador/` es el lado CIS del camino de
  escritura oficial que DOC-012 define.
- Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 4 (circuit breaker + reintentos con backoff +
  rate limiting — implementados en `src/core-client/circuit-breaker.ts`, `src/core-client/retry.ts`
  y `src/rate-limit/`) y 3 (el CIS es el único punto que valida identidad de fuentes de captura).

## Próximo paso sugerido
Fases siguientes de [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md): reemplazar
Zitadel por Keycloak en `devops/local/`/`devops/prod/`/`devops/onprem/` y en los 3 portales
(`app-qr-sicsaft/`, `ccp/`, `core/frontend/`) — hoy solo `cis/` migró, así que no hay
todavía un Keycloak real contra el cual verificar en vivo. Recién con eso resuelto vuelve a ser
posible la verificación en vivo de TASK-007 (`app-qr-sicsaft/`, ver su
`HANDOFF-APP-QR-SICSAFT.md` 7): crear el client OIDC público en Keycloak con `offline_access`
habilitado, decidir la estrategia de e2e de Playwright de APP QR, y un recorrido manual de punta a
punta — lo que queda de ROADMAP.md Fase 3 que no es opcional (la caché de entitlements invalidada
por evento está explícitamente marcada como diferible).

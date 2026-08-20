# CIS — Centro de Interoperabilidad SICSAFT (SYS-02)

## Objetivo
Punto único de entrada entre las fuentes de captura (APP QR, WEB, RFID, ERP, etc.) y SICSAFT CORE.
Responsable de autenticación, validación estructural, identificación del origen, correlación de
transacciones y despacho hacia el CORE. Ninguna fuente de captura debe hablarle directo a la
Base Patrimonial Central ni al CORE — todo pasa por acá.

## Estado
🟢 Esqueleto NestJS + **Conector QR real, proxy delgado hacia CORE** (contrato DOC-002, resuelto
contra DOC-006 2-4) + **auth real vía Zitadel** (ADR-002) + **circuit breaker propio** (WAF 4):
los 4 endpoints exigen `Authorization: Bearer <token>` y `ZitadelAuthGuard` valida
firma/issuer/audience/vencimiento contra el JWKS de Zitadel — el CIS ya no acepta
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
respaldado en Redis (ventana fija atómica vía Lua, `INCR`+`PEXPIRE`) — primer consumidor de Redis
en el código del ecosistema (ya estaba en el stack decidido, ADR-001). Elegido sobre un limiter en
memoria de proceso porque WAF 4 exige "multi-instancia sin estado en memoria compartido"; si
Redis no responde, el limiter **falla abierto** (deja pasar la request) en vez de bloquear el
flujo real Captura→CIS→CORE por una caída de un componente de protección secundario.
`auth/session` también registra en Redis el `deviceId` de la request como dispositivo activo del
operador (`src/device-registry/`, DOC-002 1 "un solo dispositivo por operador"): un dispositivo
nuevo **reemplaza** al anterior (nunca se rechaza) — no existe todavía un rol Administrador
(ROADMAP.md Fase 4) para destrabar manualmente a un operador, así que rechazar dejaría varado a
cualquiera que pierda o cambie de celular; el registro expira solo, con el mismo TTL que le queda
al token, sin requerir logout explícito. Mismo criterio de resiliencia que el rate limiter: falla
abierto ante cualquier error de Redis, porque es una restricción de negocio complementaria, no un
control de seguridad (Zitadel ya autentica). El enforcement es parcial por diseño del contrato:
`deviceId` solo llega en el body de `auth/session`, DOC-002 no lo manda en las otras 3 rutas — no
hay forma de revalidar el dispositivo en cada request sin romper ese contrato ya acordado con
APP QR.
CORS habilitado (`app.enableCors`, `src/main.ts`) vía `CIS_CORS_ORIGIN` (opcional, sin default) —
primera vez que un navegador (`app-qr-sicsaft/`, TASK-007) le habla directo a CIS, no solo
llamadas servicio-a-servicio; `app-qr-sicsaft` ya tiene un cliente HTTP real
(`HttpQrConnectorClient`) contra los 4 endpoints, pendiente de verificar en vivo (falta crear la
app OIDC en el dashboard de Zitadel, ver `../devops/local/README.md`).

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

**`GET /admin/auditoria` (2026-08-14, RF-06 — filtros agregados el mismo día)**:
`AdministradorController`/`AdministradorService` suman un puente hacia `GET /auditoria` de CORE
(mismo criterio que `getContratos`: lectura abierta, no traduce `rolesPorOrganizacion`), incluidos
los filtros `usuario`/`operacion`/`fechaDesde`/`fechaHasta` como query params (pasan tal cual a
CORE, que hace la búsqueda parcial/rango real — CIS no reinterpreta ninguno). Sin filtro por
organización — la tabla `auditoria` de CORE no tiene ese dato todavía (ver `../core/README.md`).

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
`AdministradorController`/`AdministradorService` suman ~15 endpoints nuevos, mismo patrón puente
que el resto del módulo — `POST/baja/reincorporacion/PATCH responsable/descripcion` de Activo,
`GET/POST /admin/catalogo-tipos`, `GET/POST/DELETE /admin/activos/:id/documentos`,
`POST /admin/importaciones/contable`, `GET/POST /admin/organizaciones`, `GET /admin/indicadores`.
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

## Desarrollo local
```bash
cd cis
npm install
export ZITADEL_ISSUER=http://id.sicsaft.localhost   # ver variables requeridas abajo
export ZITADEL_AUDIENCE=<client-id-de-zitadel>
npm run start:dev     # http://localhost:3000 y http://localhost:3000/health
npm run lint
npm run test:cov       # unit tests, ver nota de cobertura abajo
npm run test:e2e
npm run build
```
(No hay un `.env`/dotenv loader todavía — `main.ts` lee `process.env` directo, igual que `PORT`.
Corriendo dentro de `../devops/local/docker-compose.yml` estas variables ya vienen seteadas por
el servicio `cis`, no hace falta exportarlas a mano.)

**Variables de entorno requeridas** (ver `src/common/auth/zitadel-auth.config.ts` — el proceso no
arranca sin ellas):
- `ZITADEL_ISSUER`: el `iss` que Zitadel pone en el token (`ZITADEL_EXTERNALDOMAIN` del compose,
  ej. `http://id.sicsaft.localhost`).
- `ZITADEL_AUDIENCE`: Client ID / Resource ID de la app OIDC del CIS en Zitadel — se crea a mano
  en el dashboard, ver `../devops/local/README.md` "Cliente OIDC real".
- `ZITADEL_JWKS_URI` (opcional, default `${ZITADEL_ISSUER}/oauth/v2/keys`): solo hace falta
  sobreescribirla si alguna vez la URL para *descargar* las llaves deja de ser la misma que el
  `iss` — en Docker Compose local ya no es el caso: el servicio `traefik` tiene un alias de red
  `id.sicsaft.localhost`, así que ese dominio resuelve igual adentro y afuera de la red de
  contenedores (ver `docker-compose.yml` de `devops/local/` y su "Cliente OIDC real").
- `CORE_URL`: URL base de SICSAFT CORE (`../core/`), ej. `http://core:3001` dentro de Docker
  Compose. Ver `src/core-client/core-client.config.ts` — el proceso tampoco arranca sin esta.
- `CORE_SERVICE_TOKEN`: secreto compartido de auth servicio-a-servicio hacia CORE — debe ser
  exactamente el mismo valor que `CORE_SERVICE_TOKEN` en el proceso de CORE (ver
  `../core/README.md`). Generar con `openssl rand -hex 32`.
- `REDIS_URL`: URL de conexión a Redis (ver `src/redis/`), compartida por `RateLimitGuard`
  (`src/rate-limit/`) y `DeviceRegistryService` (`src/device-registry/`), ej.
  `redis://:password@redis:6379` dentro de Docker Compose. El cliente usa `lazyConnect` (no
  conecta hasta el primer comando) y ambos consumidores fallan abiertos ante cualquier error, así
  que un Redis temporalmente caído no bloquea el arranque ni las requests — solo se pierde esa
  protección mientras dura.
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
detrás de `ZitadelAuthGuard` (`src/common/auth/zitadel-auth.guard.ts`, sin
`Authorization: Bearer <token>` válido, 401) y luego de `RateLimitGuard`
(`src/rate-limit/rate-limit.guard.ts`, sobre el límite por operador, 429) — el orden importa,
`RateLimitGuard` necesita el `operadorId` que ya dejó `ZitadelAuthGuard` en la request:

```
POST /auth/session                          -> valida el token, devuelve el mismo token (pass-through) + organizaciones/sedes reales via GET {CORE_URL}/entitlements
GET  /catalogo?organizacionId=&areaId=&ubicacionId=  -> catálogo real via GET {CORE_URL}/catalogo
POST /inventarios                            -> proxy a POST {CORE_URL}/inventarios; idempotente por idempotencyKey (DOC-002 4), 400 si la organización no existe, 409 si la key se reutiliza con payload distinto (DOC-002 5) — los tres resueltos por CORE, no por CIS
GET  /inventarios/{id}/estado                -> proxy a GET {CORE_URL}/inventarios/{id}/estado; 404 si no existe
```

**Auth (ADR-002)**: `operadorId`/`credencial` ya no van en el body de `auth/session` — Zitadel
autentica al operador (OIDC, fuera del CIS) y el CIS solo valida el access token resultante
(firma vía JWKS, `iss`, `aud`, vencimiento) y lee `operadorId` de su claim `sub`. El CIS no emite
un token propio, hace pass-through del mismo token de Zitadel — coincide con ADR-002: "el punto
de validación es el CIS, no el token" (el JWT no lleva `sedeId`, eso se resuelve en cada request
contra CORE, ver `src/core-client/`).

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
- Nada. `app-qr-sicsaft/` (TASK-007) ya tiene un cliente HTTP real (`HttpQrConnectorClient`)
  contra estos 4 endpoints, con CORS habilitado acá (`CIS_CORS_ORIGIN`) — primera vez que un
  navegador le habla directo a CIS. Falta la verificación en vivo (crear la app OIDC en el
  dashboard de Zitadel, recorrido manual), no código de CIS — ver
  `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md` 7.

## Documentos relacionados
- [DOC-002](../aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-002-conector-qr.md) (contrato
  Conector QR) — vive en el repo de APP QR QRVault por ahora.
- [DOC-006](../aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md) (API CIS↔CORE) —
  implementado en ambos lados.
- [ADR-001](../adr/ADR-001-stack-backend-nestjs.md) (stack: NestJS/TypeScript).
- [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) — el CIS valida `organizacionId`,
  `sedeId` y vigencia de contrato en cada request, no solo identidad.
- [`seguridad/DOC-012-administrador-patrimonial.md`](../seguridad/DOC-012-administrador-patrimonial.md)
  — diseño del rol Administrador Patrimonial; `src/administrador/` es el lado CIS del camino de
  escritura oficial que DOC-012 define.
- Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 4 (circuit breaker + reintentos con backoff +
  rate limiting — implementados en `src/core-client/circuit-breaker.ts`, `src/core-client/retry.ts`
  y `src/rate-limit/`) y 3 (el CIS es el único punto que valida identidad de fuentes de captura).

## Próximo paso sugerido
Verificación en vivo de TASK-007 (`app-qr-sicsaft/`, ver su `HANDOFF-APP-QR-SICSAFT.md` 7): crear
la app OIDC real en el dashboard de Zitadel con `offline_access` habilitado
(`../devops/local/README.md` "Cliente OIDC real"), decidir la estrategia de e2e de Playwright de
APP QR, y un recorrido manual de punta a punta — lo que queda de ROADMAP.md Fase 3 que no es
opcional (la caché de entitlements invalidada por evento está explícitamente marcada como
diferible).

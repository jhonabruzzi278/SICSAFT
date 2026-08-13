# CIS — Centro de Interoperabilidad SICSAFT (SYS-02)

## Objetivo
Punto único de entrada entre las fuentes de captura (APP QR, WEB, RFID, ERP, etc.) y SICSAFT CORE.
Responsable de autenticación, validación estructural, identificación del origen, correlación de
transacciones y despacho hacia el CORE. Ninguna fuente de captura debe hablarle directo a la
Base Patrimonial Central ni al CORE — todo pasa por acá.

## Estado
🟢 Esqueleto NestJS + **Conector QR real, proxy delgado hacia CORE** (contrato DOC-002, resuelto
contra DOC-006 §2-§4) + **auth real vía Zitadel** (ADR-002) + **circuit breaker propio** (WAF §4):
los 4 endpoints exigen `Authorization: Bearer <token>` y `ZitadelAuthGuard` valida
firma/issuer/audience/vencimiento contra el JWKS de Zitadel — el CIS ya no acepta
`operadorId`/`credencial` en el body, la identidad viene del token. `QrConnectorService` ya no
mantiene estado propio (sin `Map` en memoria, sin seed): las 4 operaciones —
`getEntitlements`/`getCatalogo`/`postInventario`/`getInventarioEstado` — son pass-through hacia
`CoreClientService`, que valida cada respuesta con Zod en el límite (CORE es un proceso/red
distinto, no se asume su forma) y devuelve 502 ante cualquier falla (red, timeout, 5xx, secreto
inválido, forma inesperada) — nunca datos a medias. `CoreClientService` manda el secreto
compartido de auth servicio-a-servicio (`x-internal-service-token`, ver `../core/README.md`) —
CORE ya no acepta llamadas sin él. Todo llamado a CORE pasa además por un `CircuitBreaker` propio
(`src/core-client/circuit-breaker.ts`, WAF §4): 5 fallos consecutivos abren el circuito, 30s antes
de un sondeo half-open; mientras está abierto, `CoreClientService` devuelve 502 sin ni siquiera
intentar la llamada HTTP. Idempotencia de inventarios (DOC-002 §4/§5), validación de
organización/área/ubicación y clasificación de escaneos ya no viven en CIS — se resolvieron en
CORE (`sesiones_inventario`, Motor de Reglas, Fase 2 de ROADMAP.md); CIS solo propaga el 400/409
que CORE produce.
Probado de punta a punta: lint, unit (100% stmts/lines/funcs, 89%+ branches), e2e (incluye los
casos 502/400/404/409, con `CoreClientService` stubeado — no se levanta un CORE real), build.
Conectividad real entre contenedores `cis`↔`core` verificada con `docker network` + `docker exec`
para `GET /entitlements` (incluidos los 3 casos del secreto: sin header, correcto, incorrecto);
queda pendiente repetir esa verificación de punta a punta contra Docker real para
catálogo/inventarios (el mecanismo es el mismo `CoreClientService`, ya probado, pero no se corrió
ese `docker exec` específico todavía). Toda ruta pasa por `CorrelationIdMiddleware`
(`src/common/correlation-id/`, ROADMAP.md Fase 0), que propaga `X-Correlation-Id` hasta
`CoreClientService` — sin logging estructurado que lo use todavía (WAF §2, pendiente).
Resiliencia restante de WAF §4 (reintentos con backoff, rate limiting por operador/dispositivo) y
`deviceId` enforced (DOC-002 §1) siguen sin implementar — ver ROADMAP.md Fase 3.

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
  en el dashboard, ver `../devops/local/README.md` § "Cliente OIDC real".
- `ZITADEL_JWKS_URI` (opcional, default `${ZITADEL_ISSUER}/oauth/v2/keys`): solo hace falta
  sobreescribirla si alguna vez la URL para *descargar* las llaves deja de ser la misma que el
  `iss` — en Docker Compose local ya no es el caso: el servicio `traefik` tiene un alias de red
  `id.sicsaft.localhost`, así que ese dominio resuelve igual adentro y afuera de la red de
  contenedores (ver `docker-compose.yml` de `devops/local/` y su § "Cliente OIDC real").
- `CORE_URL`: URL base de SICSAFT CORE (`../core/`), ej. `http://core:3001` dentro de Docker
  Compose. Ver `src/core-client/core-client.config.ts` — el proceso tampoco arranca sin esta.
- `CORE_SERVICE_TOKEN`: secreto compartido de auth servicio-a-servicio hacia CORE — debe ser
  exactamente el mismo valor que `CORE_SERVICE_TOKEN` en el proceso de CORE (ver
  `../core/README.md`). Generar con `openssl rand -hex 32`.

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
[`../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md`](../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md),
resuelto contra CORE vía
[`../core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md`](../core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md).
`QrConnectorService` no tiene lógica de negocio propia — valida con Zod el request de cada
operación (`qr-connector.schemas.ts`) y delega en `CoreClientService`. Los 4 endpoints están
detrás de `ZitadelAuthGuard` (`src/common/auth/zitadel-auth.guard.ts`) — sin
`Authorization: Bearer <token>` válido, 401:

```
POST /auth/session                          -> valida el token, devuelve el mismo token (pass-through) + organizaciones/sedes reales via GET {CORE_URL}/entitlements
GET  /catalogo?organizacionId=&areaId=&ubicacionId=  -> catálogo real via GET {CORE_URL}/catalogo
POST /inventarios                            -> proxy a POST {CORE_URL}/inventarios; idempotente por idempotencyKey (DOC-002 §4), 400 si la organización no existe, 409 si la key se reutiliza con payload distinto (DOC-002 §5) — los tres resueltos por CORE, no por CIS
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
DOC-002 §5) de cualquier otra falla transitoria (502) — ver `callCore`/`passthroughStatuses` en
`core-client.service.ts`. `deviceId` no se enforced todavía (un solo dispositivo por operador,
DOC-002 §1) — requiere persistencia que hoy no existe en CIS.

## Depende de
- Más datos reales de Contrato en `../core/` (hoy solo un caso precargado sobre Postgres, ver
  [DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) §7 — sin mapeo operador→organización
  real todavía).
- Que `app-qr-sicsaft/` reemplace su stub (`LocalQrConnectorClient`) por un cliente HTTP real
  contra estos 4 endpoints (TASK-006/TASK-007) — el cliente OIDC ya está probado real de punta a
  punta con un flujo simulado vía `curl` (login real, JWT real firmado por Zitadel,
  `ZitadelAuthGuard` lo valida y CIS resuelve entitlements/catálogo/inventarios reales, ver
  `../devops/local/README.md` § "Cliente OIDC real"); falta que el código de APP QR haga ese mismo
  flujo en vez de `curl`.

## Bloquea
- Nada — TASK-006/TASK-007 de APP QR ya tienen un conector real (con auth real) contra el cual
  apuntar.

## Documentos relacionados
- [DOC-002](../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md) (contrato
  Conector QR) — vive en el repo de APP QR QRVault por ahora.
- [DOC-006](../core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md) (API CIS↔CORE) —
  implementado en ambos lados.
- [ADR-001](../adr/ADR-001-stack-backend-nestjs.md) (stack: NestJS/TypeScript).
- [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) — el CIS valida `organizacionId`,
  `sedeId` y vigencia de contrato en cada request, no solo identidad.
- Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §4 (circuit breaker — implementado en
  `src/core-client/circuit-breaker.ts`; reintentos con backoff y rate limiting hacia CORE siguen
  pendientes) y §3 (el CIS es el único punto que valida identidad de fuentes de captura).

## Próximo paso sugerido
Reintentos con backoff y rate limiting por operador/dispositivo hacia CORE (resto de WAF §4,
ROADMAP.md Fase 3), y que `app-qr-sicsaft/` (TASK-006/TASK-007) reemplace `LocalQrConnectorClient`
por un cliente HTTP real contra estos 4 endpoints.

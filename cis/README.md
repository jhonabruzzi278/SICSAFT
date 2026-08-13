# CIS — Centro de Interoperabilidad SICSAFT (SYS-02)

## Objetivo
Punto único de entrada entre las fuentes de captura (APP QR, WEB, RFID, ERP, etc.) y SICSAFT CORE.
Responsable de autenticación, validación estructural, identificación del origen, correlación de
transacciones y despacho hacia el CORE. Ninguna fuente de captura debe hablarle directo a la
Base Patrimonial Central ni al CORE — todo pasa por acá.

## Estado
🟡 Esqueleto NestJS + **mock del Conector QR** (contrato DOC-002 completo) + **auth real vía
Zitadel** (ADR-002) + **entitlements reales desde CORE** (DOC-004 §6): los 4 endpoints exigen
`Authorization: Bearer <token>` y `ZitadelAuthGuard` valida firma/issuer/audience/vencimiento
contra el JWKS de Zitadel — el CIS ya no acepta `operadorId`/`credencial` en el body, la
identidad viene del token. `auth/session` ya no devuelve un seed fijo de `organizaciones`: llama
a `GET {CORE_URL}/entitlements` vía `CoreClientService` y valida la respuesta en el límite
(zod) — si CORE no responde o responde algo inesperado, devuelve 502, nunca datos a medias.
`CoreClientService` también manda el secreto compartido de auth servicio-a-servicio
(`x-internal-service-token`, ver `../core/README.md`) — CORE ya no acepta llamadas sin él.
Probado de punta a punta: lint, unit (100% stmts/lines/funcs, 91%+ branches), e2e (incluye el
caso 502), build, y conectividad real entre contenedores `cis`↔`core` verificada con
`docker network` + `docker exec` (incluidos los 3 casos del secreto: sin header, correcto,
incorrecto). Toda ruta pasa por `CorrelationIdMiddleware` (`src/common/correlation-id/`,
ROADMAP.md Fase 0), que propaga `X-Correlation-Id` hasta `CoreClientService` — sin logging
estructurado que lo use todavía (WAF §2, pendiente). Todavía sin persistencia real (el mock de
inventarios/catálogo guarda todo en memoria).

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
  en el dashboard, ver `../devops/local/README.md` § "Qué falta".
- `ZITADEL_JWKS_URI` (opcional, default `${ZITADEL_ISSUER}/oauth/v2/keys`): solo hace falta
  sobreescribirla cuando la URL para *descargar* las llaves no es la misma que el `iss` — es el
  caso de Docker Compose local, donde `id.sicsaft.localhost` solo resuelve vía el hosts file del
  host, no dentro de la red de contenedores (ver `docker-compose.yml` de `devops/local/`).
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

## Conector QR — mock + auth real (`src/qr-connector/`, `src/common/auth/`)
Contrato completo de
[`../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md`](../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md)
implementado como mock en memoria (`QrConnectorService`), validado con Zod contra el request de
cada operación (`qr-connector.schemas.ts`). Los 4 endpoints están detrás de `ZitadelAuthGuard`
(`src/common/auth/zitadel-auth.guard.ts`) — sin `Authorization: Bearer <token>` válido, 401:

```
POST /auth/session                          -> valida el token, devuelve el mismo token (pass-through) + organizaciones/sedes reales via GET {CORE_URL}/entitlements
GET  /catalogo?organizacionId=&areaId=&ubicacionId=  -> catálogo semilla filtrado
POST /inventarios                            -> idempotente por idempotencyKey (DOC-002 §4), 400 si la organización no existe, 409 si la key se reutiliza con payload distinto (DOC-002 §5)
GET  /inventarios/{id}/estado                -> 404 si no existe
```

**Auth (ADR-002)**: `operadorId`/`credencial` ya no van en el body de `auth/session` — Zitadel
autentica al operador (OIDC, fuera del CIS) y el CIS solo valida el access token resultante
(firma vía JWKS, `iss`, `aud`, vencimiento) y lee `operadorId` de su claim `sub`. El CIS no emite
un token propio, hace pass-through del mismo token de Zitadel — coincide con ADR-002: "el punto
de validación es el CIS, no el token" (el JWT no lleva `sedeId`, eso se resuelve en cada request
contra CORE, ver `src/core-client/`).

**Entitlements (`src/core-client/`)**: `CoreClientService.getEntitlements(operadorId)` llama a
`GET {CORE_URL}/entitlements?operadorId=` con el header `x-internal-service-token` (secreto
compartido, ver arriba) y valida la respuesta con Zod (`core-client.types.ts`) — CORE es un
límite de confianza (proceso/red distinto), no se asume su forma. Cualquier falla (red, timeout,
5xx, 401 del secreto, forma inesperada) se propaga como `BadGatewayException` (502) — el operador
ve un error transitorio, no un 500 genérico ni datos parciales. `deviceId` tampoco se enforced
todavía (un solo dispositivo por operador, DOC-002 §1) — requiere persistencia que hoy no existe.

Datos semilla en `qr-connector.seed.ts`: `SEED_ORGANIZACIONES` sigue existiendo, pero solo para
la validación de "¿existe esta organización?" en `postInventario` — `auth/session` ya no la usa
en absoluto. Reemplazar ese seed en `postInventario` por CORE también queda pendiente (mismo
alcance que catálogo/inventarios, ver DOC-002 §1).

Mientras las 3 preguntas abiertas restantes a SICSAFT CORE (contrato CIS existente,
correlationId/tracing, semántica de idempotencia — auth y el modelo de Contrato ya están
resueltos) no tengan respuesta, este mock es lo que consume APP QR (TASK-006/007) en vez de la
implementación real.

## Depende de
- Más datos reales de Contrato en `../core/` (hoy solo un caso precargado sobre Postgres, ver
  [DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) §7 — sin mapeo operador→organización
  real todavía).
- Definiciones de SICSAFT CORE (contrato de API para catálogo/inventarios, tracing) para
  reemplazar el resto del mock — bloqueado, ver arriba.
- Que exista un cliente OIDC real (WEB/APP QR) haciendo authorization code + PKCE contra Zitadel
  y pasándole el token al CIS — hoy `ZitadelAuthGuard` está probado con tokens firmados a mano en
  los tests, no contra un login de verdad de punta a punta (ver `../devops/local/README.md` §
  "Qué falta").

## Bloquea
- Nada — TASK-006/TASK-007 de APP QR ya tienen un mock real (con auth real) contra el cual
  apuntar.

## Documentos relacionados
- DOC-002 (contrato Conector QR) — vive en el repo de APP QR QRVault por ahora.
- [ADR-001](../adr/ADR-001-stack-backend-nestjs.md) (stack: NestJS/TypeScript).
- [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) — el CIS valida `organizacionId`,
  `sedeId` y vigencia de contrato en cada request, no solo identidad.
- Pendiente: DOC-005 Arquitectura CIS, DOC-006 API CIS↔CORE.
- Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §4 (circuit breaker + rate limiting hacia el
  CORE) y §3 (el CIS es el único punto que valida identidad de fuentes de captura).

## Próximo paso sugerido
Levantar el mock del Conector QR como primer entregable sobre NestJS (stack ya decidido, ver
ADR-001). Tarjeta Trello: `CIS-ADR-001`.

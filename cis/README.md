# CIS — Centro de Interoperabilidad SICSAFT (SYS-02)

## Objetivo
Punto único de entrada entre las fuentes de captura (APP QR, WEB, RFID, ERP, etc.) y SICSAFT CORE.
Responsable de autenticación, validación estructural, identificación del origen, correlación de
transacciones y despacho hacia el CORE. Ninguna fuente de captura debe hablarle directo a la
Base Patrimonial Central ni al CORE — todo pasa por acá.

## Estado
🟡 Esqueleto NestJS + **mock del Conector QR** (contrato DOC-002 completo) probados de punta a
punta: lint, unit, e2e, build, `docker build`/`docker run` real contra los 4 endpoints, y
levantado dentro del stack local completo (`../devops/local/`, Traefik + Zitadel + CIS). Todavía
sin autenticación real (los 4 endpoints no validan token — eso es OIDC/Zitadel, próximo paso) ni
persistencia real (el mock guarda todo en memoria, se pierde al reiniciar el proceso).

## Desarrollo local
```bash
cd cis
npm install
npm run start:dev     # http://localhost:3000 y http://localhost:3000/health
npm run lint
npm run test:cov       # unit tests, ver nota de cobertura abajo
npm run test:e2e
npm run build
```

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

## Conector QR — mock implementado (`src/qr-connector/`)
Contrato completo de
[`../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md`](../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md)
implementado como mock en memoria (`QrConnectorService`), validado con Zod contra el request de
cada operación (`qr-connector.schemas.ts`):

```
POST /auth/session                          -> token mock + organizaciones semilla (DUOC UC / sede Melipilla)
GET  /catalogo?organizacionId=&areaId=&ubicacionId=  -> catálogo semilla filtrado
POST /inventarios                            -> idempotente por idempotencyKey (DOC-002 §4), 400 si la organización no existe, 409 si la key se reutiliza con payload distinto (DOC-002 §5)
GET  /inventarios/{id}/estado                -> 404 si no existe
```

Datos semilla en `qr-connector.seed.ts`: una organización (`duoc-uc`) con una sola sede
(`melipilla`) — ejemplo deliberado del caso de negocio de ADR-002 (contrato por sede, no por
organización completa). Todavía **no** valida token/autenticación (401 de DOC-002 §5 no
implementado — depende de OIDC/Zitadel) ni aplica Reglas patrimoniales (eso vive en CORE, fuera
de alcance del conector, ver DOC-002 §1).

Mientras las 4 preguntas abiertas a SICSAFT CORE (auth real, contrato CIS existente,
correlationId/tracing, semántica de idempotencia — ver handoff de APP QR) no tengan respuesta,
este mock es lo que consume APP QR (TASK-006/007) en vez de la implementación real.

## Depende de
- Definiciones de SICSAFT CORE (autenticación, contrato de API, tracing) para reemplazar el mock
  por la implementación real — bloqueado, ver arriba.
- Wiring de OIDC contra Zitadel (ADR-002) para el `401`/re-autenticación de DOC-002 §5.

## Bloquea
- Nada — TASK-006/TASK-007 de APP QR ya tienen un mock real contra el cual apuntar.

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

# CIS — Centro de Interoperabilidad SICSAFT (SYS-02)

## Objetivo
Punto único de entrada entre las fuentes de captura (APP QR, WEB, RFID, ERP, etc.) y SICSAFT CORE.
Responsable de autenticación, validación estructural, identificación del origen, correlación de
transacciones y despacho hacia el CORE. Ninguna fuente de captura debe hablarle directo a la
Base Patrimonial Central ni al CORE — todo pasa por acá.

## Estado
🟡 Esqueleto NestJS levantado y probado (lint, unit, e2e, build) — sin lógica de negocio todavía.
Endpoints actuales: `GET /` (identidad del servicio) y `GET /health` (para el healthcheck de
Docker/Traefik, ver `../devops/local/`). El Conector QR real (sección siguiente) es el próximo
entregable con lógica de negocio.

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

**Nota sobre `coverageThreshold.branches` (70%, no 100%)**: `emitDecoratorMetadata` de TypeScript
emite un chequeo defensivo (`typeof X === "function" ? X : Object`) para cada tipo referenciado en
una firma decorada que venga de **otro archivo** — pasa con tipos borrados en runtime (interfaces,
ej. `ServiceInfo` antes de colocarlo junto al controlador) y también con **cualquier dependencia
inyectada por constructor desde otro archivo** (ej. `AppService` en `AppController`), aunque sea
una clase real. Una rama de ese chequeo queda permanentemente inalcanzable — no por falta de
tests, sino porque es así como TS emite metadata de decoradores en cualquier proyecto NestJS con
inyección de dependencias entre archivos (que es prácticamente todos). Confirmado inspeccionando
el JS transpilado de `app.controller.ts` directamente, no es una suposición. `statements`/
`functions`/`lines` se mantienen en 100% — solo `branches` baja, y solo por esta razón estructural
documentada. Colocar una interfaz de retorno en el mismo archivo que el método decorado (ver
`health.controller.ts`) sí evita el problema *para esa interfaz puntual* — se aplicó donde fue
gratis hacerlo (`ServiceInfo` ahora vive en `app.controller.ts`), pero no existe forma de evitarlo
para constructores con dependencias de otros archivos sin renunciar a la inyección de dependencias.

## Primer conector a construir
**Conector QR** — contrato ya definido en
[`../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md`](../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md):

```
POST /auth/session
GET  /catalogo?organizacionId=&areaId=&ubicacionId=
POST /inventarios
GET  /inventarios/{id}/estado
```

Mientras las 4 preguntas abiertas a SICSAFT CORE (auth real, contrato CIS existente,
correlationId/tracing, semántica de idempotencia — ver handoff de APP QR) no tengan respuesta,
este conector debe implementarse primero como **mock** para no bloquear TASK-006/007 de APP QR.

## Depende de
- Definiciones de SICSAFT CORE (autenticación, contrato de API, tracing) — bloqueado, ver arriba.

## Bloquea
- TASK-006/TASK-007 de APP QR (cliente real del Conector QR) — desbloqueable con un mock.

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

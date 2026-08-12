# CIS — Centro de Interoperabilidad SICSAFT (SYS-02)

## Objetivo
Punto único de entrada entre las fuentes de captura (APP QR, WEB, RFID, ERP, etc.) y SICSAFT CORE.
Responsable de autenticación, validación estructural, identificación del origen, correlación de
transacciones y despacho hacia el CORE. Ninguna fuente de captura debe hablarle directo a la
Base Patrimonial Central ni al CORE — todo pasa por acá.

## Estado
🔲 No iniciado. Carpeta creada como placeholder dentro del plan maestro del ecosistema.

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

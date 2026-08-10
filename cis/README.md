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
[`../qrvault/aidlc-docs/design-artifacts/DOC-002-conector-qr.md`](../qrvault/aidlc-docs/design-artifacts/DOC-002-conector-qr.md):

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
- Pendiente: DOC-005 Arquitectura CIS, DOC-006 API CIS↔CORE.

## Próximo paso sugerido
Definir stack tecnológico (ADR) y levantar el mock del Conector QR como primer entregable.

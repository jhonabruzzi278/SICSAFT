# User Stories — CORE Fase 2

Formuladas desde el operador de APP QR (consumidor final, vía CIS) aunque el cliente real todavía
no exista (TASK-007, Fase 3) — son las mismas historias que ya implican DOC-002 y
`scan-resolve.ts`, ahora resueltas del lado del servidor.

## Consulta de catálogo

**Como** operador de inventario, **quiero** descargar el catálogo de activos de mi
organización/área/ubicación al iniciar un inventario, **para** poder validar escaneos sin
depender de conexión permanente (DOC-002 3, ya el patrón que usa `ScanPage`).

- **Criterio de aceptación**: `GET /catalogo?organizacionId=X&areaId=Y&ubicacionId=Z` devuelve
  solo los activos de esa combinación exacta, paginado.

## Escaneo correcto

**Como** operador, **quiero** que un código QR que corresponde a un activo de mi
área/ubicación se registre como `correcto`, **para** confirmar que el inventario físico coincide
con el patrimonial.

- **Dado** un activo con `estado='activo'`, `areaId`/`ubicacionId` igual a los de mi sesión,
  **cuando** escaneo su `codigoQr`, **entonces** `POST /inventarios` responde `estado: 'recibido'`
  y el resultado clasificado es `correcto`.

## Escaneo en otra área / otra ubicación

**Como** operador, **quiero** que un activo que existe pero está en otra área o ubicación se
marque como tal (no como "no registrado"), **para** poder reportarlo como mal ubicado en vez de
perderlo del reporte.

- **Dado** un activo cuyo `areaId` no coincide con el de mi sesión (pero existe),
  **cuando** lo escaneo, **entonces** el resultado es `otra_area` (o `otra_ubicacion` si el área
  coincide pero la ubicación no), nunca `no_registrado`.

## Escaneo no registrado / código inválido

**Como** operador, **quiero** distinguir un código que no corresponde a ningún activo
(`no_registrado`) de un código que ni siquiera tiene formato válido (`codigo_invalido`),
**para** saber si necesito dar de alta el activo o si el QR está dañado/mal impreso.

## Escaneo duplicado

**Como** Motor de Reglas, **quiero** detectar cuando un `codigoQr` está asignado a más de un
activo (inconsistencia de datos, no de operación), **para** marcarlo `duplicado` — esto **solo**
lo puede detectar CORE contra la Base Patrimonial real, nunca el cliente (ver
`base-patrimonial/DOC-005-modelo-patrimonial.md` 5, nota heredada del handoff de APP QR).

## Escaneo ya escaneado

**Como** operador, **quiero** que reescanear el mismo código dentro de la misma sesión de
inventario se marque `ya_escaneado` sin duplicar el registro, **para** que el reporte final sea
correcto aunque escanee el mismo activo dos veces por error.

## Reintento idempotente

**Como** cliente (CIS, en nombre de la app), **quiero** que reenviar el mismo
`POST /inventarios` con el mismo `idempotencyKey` tras un timeout de red devuelva el mismo
resultado sin crear un segundo registro, **para** que un reintento de red nunca duplique un
inventario (DOC-002 4).

- **Criterio de aceptación**: dos `POST /inventarios` con el mismo `idempotencyKey` y el mismo
  payload devuelven el mismo `inventarioId`. El mismo `idempotencyKey` con payload **distinto**
  devuelve `409 Conflict` (ya el comportamiento documentado en DOC-002 5, hoy implementado del
  lado equivocado — CIS en memoria — se mueve a CORE persistido).

## Traslado / cambio de ubicación

**Como** operador con permiso de traslado, **quiero** registrar que un activo cambió de
ubicación, **para** que el siguiente inventario en la ubicación de destino lo encuentre
`correcto`.

- **Criterio de aceptación**: el traslado genera un evento `traslado` con `detalle` que incluye
  `ubicacionAnteriorId`/`ubicacionNuevaId` (`base-patrimonial/DOC-005-modelo-patrimonial.md` 6).

## Auditoría de toda operación

**Como** responsable de cumplimiento, **quiero** que toda operación (exitosa o rechazada) quede
en `auditoria` con usuario/fecha/IP/operación/resultado, **para** poder reconstruir qué pasó ante
una discrepancia (Tomo IV 2.9).

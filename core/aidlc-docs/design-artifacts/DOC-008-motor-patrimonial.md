# DOC-008: Motor Patrimonial (alcance MVP — Fase 2)

> **Actualización (Fase 4)**: alta/baja/reincorporación/cambio de responsable, dejadas fuera de
> esta fase a propósito (ver abajo), **ya están implementadas** —
> [`seguridad/DOC-012-administrador-patrimonial.md`](../../../seguridad/DOC-012-administrador-patrimonial.md)
> 5, `src/patrimonial/activo-escritura.controller.ts`. Esta sección queda como registro de la
> decisión original de alcance, no como estado actual — ver DOC-012 para el diseño real de esas
> 4 operaciones.

## Alcance de esta fase

Consulta, catálogo, verificación por inventario, cambio de ubicación/estado, traslado — **no**
alta/baja/reincorporación/cambio de responsable (Tomo III 4.15, esas son del Administrador
Patrimonial, Fase 4, único autorizado a escribir oficialmente la base, Tomo III 1.4).

## Contrato del repository

Mismo patrón que `core/src/entitlements/contrato.repository.ts` (Fase 0/DOC-004) — SQL directo
con `pg`, sin ORM:

```ts
interface ActivoRepository {
  findByCodigoQr(codigoQr: string, organizacionId: string): Promise<Activo | null>;
  findCatalogo(filtro: CatalogoFiltro): Promise<Activo[]>;  // paginado, RNF-01
  actualizarUbicacion(activoId: string, ubicacionId: string, contexto: ContextoOperacion): Promise<void>;
  actualizarEstado(activoId: string, estado: EstadoActivo, contexto: ContextoOperacion): Promise<void>;
}
```

`findByCodigoQr` es el que usa el Motor de Reglas para resolver cada escaneo (DOC-009) — recibe
`organizacionId` porque un `codigoQr` fuera de esa organización debe tratarse como
`no_registrado`, no filtrarse a nivel SQL con un `WHERE` que además exponga el activo de otra
organización en un error distinto (mismo criterio que ya aplica `scan-resolve.ts` del lado del
cliente).

## Traslado y cambio de ubicación/estado

No son parte de `POST /inventarios` (eso es verificación, no movimiento) — quedan modelados como
la extensión natural de este motor pero **sin endpoint HTTP propio en esta fase**: no hay
consumidor real todavía (ningún cliente de APP QR pide trasladar un activo hoy, ver
`app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-001-flujo-oficial.md`).

**Corrección (2026-08-14, revisión de requisitos)**: esta sección decía "se deja el método en el
repository" — verificado contra el código, `ActivoRepository` **no tiene** `actualizarUbicacion`
ni `actualizarEstado` (búsqueda directa en `src/patrimonial/activo.repository.ts`, ningún
resultado). Ninguna de las dos existe todavía, ni como scaffold — el diseño original de esta
sección se adelantó a la implementación. YAGNI se sostiene: sin consumidor real, no vale la pena
ni el scaffold — cuando aparezca uno, se construye el método y el controller juntos, no antes.

## Invariantes que valida (antes de escribir, no solo con un CHECK de Postgres)

- `estado` solo transiciona según el diagrama de `base-patrimonial/DOC-005-modelo-patrimonial.md`
  4 — un intento de mover `dado_de_baja → activo` sin pasar por Fase 4 (Administrador
  Patrimonial) se rechaza con `400`, no con una excepción de constraint SQL sin contexto.
- Todo cambio de ubicación/estado genera un evento (`traslado` o `movimiento`, DOC-010) — nunca
  se actualiza `activos` sin dejar rastro en `eventos` (Tomo III 4.10, historial nunca se pierde).

## Documentos relacionados

[DOC-005](../../../base-patrimonial/DOC-005-modelo-patrimonial.md) 4 — máquina de estados de
`Activo` que este motor aplica. [DOC-009](DOC-009-motor-reglas.md) — quién invoca
`findByCodigoQr`.

# DOC-007: Arquitectura CORE — Orquestador (Fase 2)

> Diagramas completos (secuencia, módulos) en
> [`ARCHITECTURE.md`](ARCHITECTURE.md) — este documento fija las responsabilidades puntuales del
> Orquestador que el diagrama no explicita en texto.

## Responsabilidad única

Tomo IV §2.4: "recibe toda operación, identifica origen, determina motores involucrados,
controla secuencia, publica eventos, cierra transacción". En código: `OrquestadorService` es la
**única** clase que conoce el orden `Reglas → Patrimonial → Eventos → Auditoría` — ningún
controller invoca un motor directamente (RF-06).

## Contrato interno

```ts
interface OrquestadorService {
  procesarInventario(
    payload: InventarioRequest,
    contexto: ContextoOperacion,
  ): Promise<PostInventarioResponse>;
}
```

Un único método público en esta fase — `procesarInventario`. No se generaliza a un
`ejecutar(operacion: string, payload: unknown)` genérico todavía: con un solo caso de uso real
(inventario), una interfaz genérica sería abstracción especulativa (YAGNI). Se generaliza cuando
exista un segundo caso de uso real (ej. traslado como operación independiente de un inventario).

## Qué hace, en orden (ver secuencia completa en ARCHITECTURE.md)

1. Arma `ContextoOperacion` desde la request ya autenticada (correlationId, operadorId).
2. Delega en `InventariosService` la resolución de idempotencia + Motor de Reglas + persistencia.
3. Registra en Auditoría el resultado — **siempre**, éxito o rechazo (RF-04).
4. Nunca deja una excepción no controlada escapar sin auditar: todo `catch` a nivel Orquestador
   registra el motivo en `auditoria` antes de re-lanzar (Tomo IV: "la transacción se cancela de
   forma controlada, registrando el motivo").

## Qué NO hace

- No valida el shape del payload (eso es el `ZodValidationPipe` en el controller, ya el patrón
  establecido).
- No decide la categoría de un escaneo (eso es `clasificarEscaneo`, una función pura del Motor de
  Reglas — DOC-009).
- No abre conexión a la base directamente — delega en los repositories de cada motor.

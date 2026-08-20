# DOC-010: Motor de Eventos (Fase 2)

## Alcance MVP

Un repository, sin controller propio (RF-06, invocado solo por el Orquestador/otros motores):

```ts
interface EventoRepository {
  registrar(evento: {
    activoId: string;
    tipo: TipoEvento;   // vocabulario de DOC-005 6
    usuario?: string;
    detalle?: Record<string, unknown>;
  }): Promise<void>;
}
```

## Qué genera eventos en esta fase

| Situación | `tipo` | `detalle` |
|---|---|---|
| Escaneo clasificado `correcto`/`otra_area`/`otra_ubicacion`/etc. dentro de una sesión de inventario | `escaneo_qr` | `{ resultado, sesionId }` |
| Cambio de ubicación (DOC-008) | `traslado` | `{ ubicacionAnteriorId, ubicacionNuevaId }` |
| Cambio de estado que no es traslado (ej. `activo → extraviado`) | `movimiento` | `{ estadoAnterior, estadoNuevo }` |

`alta`, `cambio_responsable`, `mantenimiento`, `salida_autorizada`, `salida_no_autorizada`,
`baja`, `reincorporacion` — vocabulario ya reservado en DOC-005 6, sin escritor en esta fase
(pertenecen a Fase 4, Administrador Patrimonial, o a un módulo futuro).

## Por qué no tiene lógica propia más allá de insertar

Motor de Eventos es deliberadamente "tonto" en esta fase: registra lo que otros motores le piden
registrar, no decide cuándo generarse un evento (esa decisión vive en `InventariosService`/
`ActivoRepository`, que son quienes conocen el contexto de negocio). Evita duplicar la lógica de
"cuándo" en dos lugares.

## Documentos relacionados

[DOC-005](../../../base-patrimonial/DOC-005-modelo-patrimonial.md) 6 — vocabulario de `tipo`.
[ARCHITECTURE.md](ARCHITECTURE.md) — secuencia completa mostrando cuándo se invoca.

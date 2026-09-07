# Revisión de código — instrumentación

**Objetivo**: dar números reproducibles a la revisión de código y documentación
([DOC-032](../../aidlc-docs/revision-codigo/DOC-032-revision-de-codigo-y-documentacion.md)) y
alimentar el [grafo de revisión](../../aidlc-docs/diagrams/grafo-revision-codigo.html).

**Estado**: en uso. No es desplegable ni tiene workflow de CI propio (igual que
`herramientas/etl-contable/`, que corre del lado del operador). Node puro, sin dependencias.

## Uso

```bash
node herramientas/revision-codigo/inventario.mjs           # escribe inventario.json
node herramientas/revision-codigo/inventario.mjs --tabla   # además imprime la tabla por sistema
node herramientas/revision-codigo/inventario.mjs --grafo   # además regenera el grafo HTML
```

## Los dos archivos, y por qué están separados

| Archivo | Quién lo escribe | Qué guarda |
|---|---|---|
| `inventario.json` | El script, en cada corrida | Métricas calculadas: líneas, % de comentario, ratio de test, comentarios huérfanos, docs desactualizados. |
| `estado-revision.json` | A mano | El criterio: estado de avance por sistema y los hallazgos con su evidencia. |

Volver a correr el script recalcula las métricas **sin pisar el criterio ya aplicado**. Si
estuvieran en el mismo archivo, cada corrida borraría el avance.

## Qué detecta, y qué no

`huerfanos` — comentarios que citan un archivo que ya no existe en el repo. Es el hallazgo más
objetivo de la revisión: no depende de gusto. Se le sacaron cuatro familias de falso positivo
validando la primera corrida contra el repo real (33 candidatos → 15 verificados):

- globs (`*.schemas.ts`) — nombran un patrón, no un archivo;
- salidas de build (`dist/main.js`) — no versionadas, pero existen al ejecutar;
- `.d.ts` de dependencias (`electron.d.ts`);
- nombres partidos por el salto de línea — un comentario que envuelve `service-` /
  `orchestrator.ts` cita un archivo que **sí** existe.

El repo está en CRLF: el script normaliza al leer. Sin eso, el `\r` invisible al final de cada
línea rompe en silencio cualquier chequeo de fin de línea.

**Lo que el script NO hace es decidir.** Marca candidatos y los ordena. Un archivo con 40% de
comentario puede ser el mejor del repo — ver el criterio de qué se queda y qué se va en DOC-032 §2.

# `herramientas/generador-qr/` — Generador de QR / Etiquetas (uso interno)

DOC-029 RF-F, extraído del CCP el 2026-09-13 (Fase 5 de la reestructuración CCP/CIP). App de
escritorio Electron que genera e imprime las etiquetas QR/Code 128 de todos los activos de un
cliente **antes** de que su Excel entre al sistema SICSAFT.

**La corre el equipo SICSAFT, no el cliente.** Es un paso previo al onboarding: una vez que el
Profesional de AFT del cliente prepara su Excel de activos, alguien del equipo SICSAFT abre esta
herramienta, elige ese Excel y genera/imprime las etiquetas para pegarlas físicamente en los
bienes — todo antes de que ese mismo Excel se cargue de verdad a la BPI vía
`herramientas/etl-contable/`.

**No es un desplegable.** Como `herramientas/etl-contable/`, no tiene Dockerfile ni workflow de CI
propio — es una herramienta de escritorio de uso puntual, sin usuarios concurrentes ni necesidad
de despliegue continuo.

## Por qué no habla con CIS/CORE

Esta herramienta corre **completamente desconectada**: nunca hace una request de red, nunca toca
la BPI. Reusa `herramientas/etl-contable/etl_contable.py` en su modo `--salida -` (dry-run,
documentado ahí como "nunca escribe en Postgres") como subproceso local — el mismo script que
`sicsaft-core` invoca para la ingesta real, sin --cis-url/--token, así que solo hace falta Python
instalado en la PC de quien la corre. El resultado es el mismo JSON canónico (`codigoQr` ya
acuñado, `direccionNombre`/`departamentoNombre`/`areaNombre` ya resueltos) que usaría la ingesta
real — esta herramienta solo lo toma y arma la hoja de etiquetas imprimible.

```
Excel del cliente
   ↓  python etl_contable.py --salida -   (subproceso local, sin red)
JSON canónico (codigoQr acuñado, direcciones/áreas resueltas)
   ↓  agruparParaEtiquetas (portado de ccp/src/lib/etiquetas.ts)
Hoja de etiquetas QR + Code 128, lista para imprimir
```

## Qué se portó de `ccp/` (no se reimplementó)

- `src/renderer/src/lib/code128.ts` — generador Code 128-B sin dependencias.
- `src/renderer/src/lib/etiquetas.ts` — agrupación Dirección→Departamento→Área. Única diferencia
  real con la versión de `ccp/`: acá agrupa directo sobre la fila plana que devuelve el ETL
  (`direccionNombre`/`departamentoNombre`/`areaNombre` ya vienen resueltos como texto), sin
  necesitar el join contra `Area[]` por `areaId` que sí hace falta en CCP (que parte del catálogo
  ya cargado en la BPI vía CIS).
- `src/renderer/src/components/EtiquetaActivo.tsx` — las 3 plantillas (Avery 3×10, Tarjetas 2×5,
  Térmica 1×1) + los estilos `@media print` (`src/renderer/src/index.css`), idénticos a
  `ccp/src/index.css`.
- Los 3 archivos conservan sus tests (`*.test.ts`), portados junto con el código.

## Desarrollo

```bash
cd herramientas/generador-qr
bun install
bun run dev             # ventana de Electron con HMR
bun run typecheck
bun run lint:ci
bun run test
bun run build            # compila main/preload/renderer a out/
```

Requiere Python en el PATH del sistema para correr el ETL (`SICSAFT_ETL_PYTHON` para apuntar a un
venv concreto). En dev resuelve `herramientas/etl-contable/etl_contable.py` como carpeta hermana;
ver `src/main/services/etl-runner.ts`.

## Empaquetado

`bun run dist:win` genera el instalador y copia `etl_contable.py` a
`resources/etl-contable/`. Python y sus dependencias deben estar instalados en la PC; se puede
seleccionar un ejecutable concreto con `SICSAFT_ETL_PYTHON`. La herramienta no ejecuta rutas que
no hayan sido elegidas mediante sus diálogos nativos.

## Depende de

- `herramientas/etl-contable/etl_contable.py` — nunca se duplica su lógica de mapeo/acuñado de
  `codigoQr`, se invoca como subproceso.

## Bloquea

Ningún sistema depende de esta herramienta — es de uso interno y manual.

# `herramientas/etl-contable/` — ETL de la base contable en Excel

DOC-029 RF-B. Traduce el `.xls`/`.xlsx` que mantiene el especialista contable de cada
organización al modelo de una fila de importación de SICSAFT y **postea el lote a CIS**.

**No es un desplegable.** Es una herramienta que el `.exe` de `sicsaft-core` invoca desde el
watcher de la carpeta de ingesta (RF-B.4), y que también se puede correr a mano para probar.

## Flujo — nunca escribe en Postgres

```
Excel del especialista contable
   ↓  etl_contable.py  (este script)
POST /admin/importaciones/contable/lote   →  CIS
   ↓
POST /importaciones/contable/lote          →  CORE  (lote en `pendiente_revision`)
   ↓
Profesional de AFT revisa y APRUEBA en el CCP
   ↓
CORE resuelve-o-crea área/responsable/catálogo por nombre e inserta los activos → Base Patrimonial
```

El invariante de CLAUDE.md ("ninguna fuente de captura modifica la Base Patrimonial
directamente; todo pasa por CIS → CORE") se cumple: este ETL es un cliente más de
`POST /importaciones/contable/lote`.

## Qué hace

1. Detecta la fila de encabezado (busca una celda `CODIGO`; configurable).
2. Renombra columnas del Excel a los campos canónicos según el mapeo de la organización.
3. Rellena hacia abajo las celdas combinadas (`DIRECCION` / `AREA` / `RESPONSABLE`).
4. Normaliza `VALOR.CLP.` (formato CL: `.` miles, `,` decimales).
5. **Acuña `codigoQr`** a partir del `codigoPatrimonial` (`DG-001` → `DG-001`).
6. Manda **los nombres tal cual del Excel** (`categoriaNombre`, `areaNombre`,
   `responsableNombre`, `direccionNombre`) — CORE los resuelve-o-crea al aprobar. Además guarda
   el bloque `crudo` con las columnas originales, para que el revisor vea qué llegó.

## Uso

```bash
pip install -r requirements.txt

# ver el cuerpo que se mandaría, sin enviarlo:
python etl_contable.py --entrada activos.xls --organizacion municipalidad-melipilla --salida -

# enviarlo a CIS:
python etl_contable.py --entrada activos.xls --organizacion municipalidad-melipilla \
  --cis-url http://127.0.0.1:56000 --token "$JWT"
```

| Flag | |
|---|---|
| `--entrada` | Archivo `.xls` o `.xlsx` (obligatorio) |
| `--organizacion` | `organizacionId` de SICSAFT (obligatorio) |
| `--mapeo` | `mapeo-<organizacionId>.json` — nombres de columna del Excel del cliente. Sin esto usa `mapeo/mapeo-ejemplo.json` |
| `--cis-url` / `--token` | Base URL de CIS + Bearer JWT (o usar `--salida -`) |
| `--salida -` | Imprime el JSON por stdout en vez de enviarlo |

## Mapeo por organización

Copiar [`mapeo/mapeo-ejemplo.json`](mapeo/mapeo-ejemplo.json) a `mapeo-<organizacionId>.json` y
ajustar `columnas` a los nombres reales del Excel del cliente. Los valores son los campos
canónicos: `codigoPatrimonial`, `direccionNombre`, `areaNombre`, `responsableNombre`,
`categoriaNombre`, `nombreAft`, `serie`, `valorPatrimonial`.

## Desarrollo

```bash
pip install -r requirements-dev.txt
ruff check . && ruff format --check .
pytest
```

## Documentos relacionados

[DOC-029](../../aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) RF-B ·
[DOC-016](../../aidlc-docs/integraciones/design-artifacts/DOC-016-conector-con-contabilidad.md)
(diseño de transporte del que hereda) · `cis/src/administrador/` (endpoint puente) ·
`core/src/patrimonial/importacion-contable-lote.*` (bandeja de staging).

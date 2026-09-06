"""Genera los .xlsx fixture para 18-ingesta-excel.spec.ts (DOC-029 RF-B).

No corre en la corrida del harness -- se ejecuta a mano una vez y los .xlsx quedan
commiteados al lado. Usa el Python vendorizado del `.exe` (trae pandas + openpyxl):

  "%LOCALAPPDATA%\\Programs\\SICSAFT CORE\\resources\\etl-contable\\python\\python.exe" \\
    sicsaft-core/e2e/fixtures/gen-activos-contable.py

Forma real del Excel del cliente (misma que el fixture del pytest del ETL en
herramientas/etl-contable/tests/): filas de basura arriba, encabezado más abajo, celdas
"combinadas" (vacías) que el ETL rellena hacia abajo, una fila totalmente vacía que se descarta.
Códigos con un solo guion -> `acunar_qr` produce un codigoQr que cumple el patrón de escaneo
(no dispara el AVISO del ETL).
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

AQUI = Path(__file__).resolve().parent

# --- fixture "feliz": 4 activos, todos dry-run = crear en una BPI recién instalada ---------------
FILAS_OK = [
    [None] * 8,
    [None] * 8,
    ["E2E - Ingesta contable supervisada", None, None, None, None, None, None, None],
    [None] * 8,
    ["No.", "DIRECCION", "CODIGO", "NOMBRE AFT", "CATEGORIA", "AREA", "RESPONSABLE", "VALOR.CLP."],
    [1, "DIRECCION E2E", "E2E-001", "1 NOTEBOOK", "INFORMATICA", "OFICINA E2E", "ENCARGADO E2E", "$850.000"],
    [2, None, "E2E-002", "1 MONITOR", "INFORMATICA", None, None, "120000"],
    [3, None, "E2E-003", "1 TECLADO", "INFORMATICA", None, None, None],
    [None] * 8,
    [4, "JURIDICO E2E", "E2E-004", "1 IMPRESORA", "INFORMATICA", "OFICINA ABOGADO E2E", "ABOGADO E2E", "1.234.567,50"],
]

# --- fixture "malformado": sin celda CODIGO -> el ETL corta con ValueError y el archivo va a .error/
FILAS_MALO = [
    ["columna_a", "columna_b", "columna_c"],
    ["x", "y", "z"],
    ["1", "2", "3"],
]


def escribir(nombre: str, filas: list[list[object]]) -> None:
    destino = AQUI / nombre
    pd.DataFrame(filas).to_excel(destino, header=False, index=False, engine="openpyxl")
    print(f"escrito {destino}  ({destino.stat().st_size} bytes)")


if __name__ == "__main__":
    escribir("activos-contable-e2e.xlsx", FILAS_OK)
    escribir("activos-contable-malformado.xlsx", FILAS_MALO)

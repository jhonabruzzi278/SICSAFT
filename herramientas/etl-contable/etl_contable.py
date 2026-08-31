"""ETL de la base contable en Excel a la bandeja de staging de SICSAFT (DOC-029 RF-B).

Lee el .xls/.xlsx que deja el especialista contable, lo normaliza al modelo de una fila de
importación (nombres tal cual del Excel — CORE los resuelve-o-crea al aprobar), acuña el codigoQr,
y postea el lote a CIS. **Nunca escribe en Postgres**: el flujo es ETL -> CIS -> CORE -> Base
Patrimonial, y solo al aprobar el Profesional de AFT desde el CCP.

Uso:
    python etl_contable.py --entrada activos.xls --organizacion muni \\
        --cis-url http://127.0.0.1:56000 --token "$JWT"

    # sin enviar, solo ver el cuerpo que se mandaría:
    python etl_contable.py --entrada activos.xls --organizacion muni --salida -
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd

# Mismo patrón que app-qr-sicsaft/src/lib/scan-resolve.ts / core clasificar-escaneo.ts.
PATRON_QR = re.compile(r"^[A-Z0-9]+(-[A-Z0-9]+)?$")

# Mapeo por defecto: nombres de columna del Excel -> campo canónico de la fila de importación.
MAPEO_POR_DEFECTO: dict[str, Any] = {
    "hoja": "REGISTRO DE ACTIVOS NUEVOS",
    "marcador_encabezado": "CODIGO",
    "columnas": {
        "CODIGO": "codigoPatrimonial",
        "DIRECCION": "direccionNombre",
        "AREA": "areaNombre",
        "RESPONSABLE": "responsableNombre",
        "CATEGORIA": "categoriaNombre",
        "NOMBRE AFT": "nombreAft",
        "SERIE": "serie",
        "VALOR.CLP.": "valorPatrimonial",
    },
    "rellenar_hacia_abajo": ["direccionNombre", "areaNombre", "responsableNombre"],
}

CAMPOS_OPCIONALES_TEXTO = (
    "direccionNombre",
    "areaNombre",
    "responsableNombre",
    "categoriaNombre",
    "nombreAft",
    "serie",
)


def cargar_mapeo(ruta: Path | None) -> dict[str, Any]:
    if ruta is None:
        return MAPEO_POR_DEFECTO
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    return {**MAPEO_POR_DEFECTO, **datos}


def leer_excel(entrada: Path, hoja: str | None) -> pd.DataFrame:
    """Lee la hoja indicada sin interpretar encabezados (header=None)."""
    motor = "xlrd" if entrada.suffix.lower() == ".xls" else None
    xl = pd.ExcelFile(entrada, engine=motor)
    nombre_hoja = hoja if hoja in xl.sheet_names else _hoja_con_marcador(xl)
    return xl.parse(nombre_hoja, header=None, dtype=str)


def _hoja_con_marcador(xl: pd.ExcelFile) -> str:
    """Elige la primera hoja que tenga una celda 'CODIGO' — la tabla de activos."""
    for nombre in xl.sheet_names:
        df = xl.parse(nombre, header=None, dtype=str, nrows=30)
        if _buscar_fila_encabezado(df, "CODIGO") is not None:
            return nombre
    return xl.sheet_names[0]


def _buscar_fila_encabezado(df: pd.DataFrame, marcador: str) -> int | None:
    objetivo = marcador.strip().upper()
    for i in range(len(df)):
        celdas = {str(v).strip().upper() for v in df.iloc[i].tolist() if pd.notna(v)}
        if objetivo in celdas:
            return i
    return None


def aplicar_encabezado(df: pd.DataFrame, fila_encabezado: int) -> pd.DataFrame:
    encabezados = [
        str(v).strip() if pd.notna(v) else f"col_{j}"
        for j, v in enumerate(df.iloc[fila_encabezado].tolist())
    ]
    cuerpo = df.iloc[fila_encabezado + 1 :].copy()
    cuerpo.columns = encabezados
    return cuerpo.reset_index(drop=True)


def renombrar_columnas(df: pd.DataFrame, columnas: dict[str, str]) -> pd.DataFrame:
    # `columnas` mapea nombre-de-Excel -> campo-canónico. Solo se quedan las columnas mapeadas.
    presentes = {orig: dest for orig, dest in columnas.items() if orig in df.columns}
    return df[list(presentes)].rename(columns=presentes)


def rellenar_hacia_abajo(df: pd.DataFrame, campos: list[str]) -> pd.DataFrame:
    salida = df.copy()
    for campo in campos:
        if campo in salida.columns:
            col = salida[campo].map(_o_none)
            salida[campo] = col.ffill()
    return salida


def _o_none(valor: Any) -> Any:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto if texto and texto.lower() != "nan" else None


def normalizar_valor(valor: Any) -> float | None:
    """Formato CL: '.' = miles, ',' = decimales.

    '$850.000' -> 850000.0 · '1.234.567,50' -> 1234567.5 · '1234,5' -> 1234.5.
    Devuelve None si está vacío, no es un número, o es negativo.
    """
    if valor is None:
        return None
    texto = str(valor).strip()
    if not texto or texto.lower() == "nan":
        return None
    texto = re.sub(r"[^\d,.-]", "", texto)
    texto = texto.replace(".", "").replace(",", ".")
    try:
        numero = float(texto)
    except ValueError:
        return None
    return numero if numero >= 0 else None


def acunar_qr(codigo_patrimonial: str) -> str:
    """Deriva el codigoQr del código patrimonial (DG-001 -> DG-001)."""
    return codigo_patrimonial.strip().upper()


def construir_filas(df: pd.DataFrame, df_crudo: pd.DataFrame) -> list[dict[str, Any]]:
    """`df` ya renombrado/rellenado; `df_crudo` con los nombres y valores originales del Excel
    (para el bloque `crudo`, que el revisor ve tal cual llegó)."""
    filas: list[dict[str, Any]] = []
    for pos in range(len(df)):
        cruda = df.iloc[pos]
        codigo = _o_none(cruda.get("codigoPatrimonial"))
        if codigo is None:
            continue  # fila de sección / vacía
        original = df_crudo.iloc[pos]
        fila: dict[str, Any] = {
            "linea": pos + 1,
            "codigoPatrimonial": codigo,
            "codigoQr": acunar_qr(codigo),
            "crudo": {
                str(k): str(v).strip() for k, v in original.items() if _o_none(v) is not None
            },
        }
        for campo in CAMPOS_OPCIONALES_TEXTO:
            valor = _o_none(cruda.get(campo))
            if valor is not None:
                fila[campo] = valor
        valor_num = normalizar_valor(cruda.get("valorPatrimonial"))
        if valor_num is not None:
            fila["valorPatrimonial"] = valor_num
        filas.append(fila)
    return filas


def procesar(entrada: Path, organizacion: str, mapeo: dict[str, Any]) -> dict[str, Any]:
    crudo = leer_excel(entrada, mapeo.get("hoja"))
    fila_enc = _buscar_fila_encabezado(crudo, mapeo["marcador_encabezado"])
    if fila_enc is None:
        raise ValueError(
            f"No se encontró la fila de encabezado (marcador "
            f"'{mapeo['marcador_encabezado']}') en {entrada.name}."
        )
    tabla_original = aplicar_encabezado(crudo, fila_enc)
    tabla = renombrar_columnas(tabla_original, mapeo["columnas"])
    tabla = rellenar_hacia_abajo(tabla, mapeo["rellenar_hacia_abajo"])
    filas = construir_filas(tabla, tabla_original)
    if not filas:
        raise ValueError(f"{entrada.name}: 0 filas con codigoPatrimonial.")
    qr_invalidos = [f["codigoQr"] for f in filas if not PATRON_QR.match(f["codigoQr"])]
    if qr_invalidos:
        print(
            f"AVISO: {len(qr_invalidos)} codigoQr no cumplen el patrón de escaneo "
            f"(ej. {qr_invalidos[0]}). Se envían igual; revisar antes de imprimir etiquetas.",
            file=sys.stderr,
        )
    return {
        "organizacionId": organizacion,
        "origen": "carpeta",
        "archivoNombre": entrada.name,
        "filas": filas,
    }


def enviar_a_cis(cuerpo: dict[str, Any], cis_url: str, token: str) -> dict[str, Any]:
    import requests  # import diferido: no hace falta para --salida -

    resp = requests.post(
        f"{cis_url.rstrip('/')}/admin/importaciones/contable/lote",
        json=cuerpo,
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    if resp.status_code >= 400:
        raise SystemExit(f"CIS respondió {resp.status_code}: {resp.text[:500]}")
    return resp.json()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entrada", required=True, type=Path, help="Archivo .xls/.xlsx")
    parser.add_argument("--organizacion", required=True, help="organizacionId de SICSAFT")
    parser.add_argument("--mapeo", type=Path, help="mapeo-<org>.json (opcional)")
    parser.add_argument("--cis-url", help="Base URL de CIS (ej. http://127.0.0.1:56000)")
    parser.add_argument("--token", help="Bearer JWT para CIS")
    parser.add_argument(
        "--salida",
        help="'-' imprime el cuerpo JSON por stdout en vez de enviarlo a CIS",
    )
    args = parser.parse_args(argv)

    cuerpo = procesar(args.entrada, args.organizacion, cargar_mapeo(args.mapeo))

    if args.salida == "-":
        json.dump(cuerpo, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return 0

    if not args.cis_url or not args.token:
        parser.error("se necesita --cis-url y --token (o usar --salida -)")
    respuesta = enviar_a_cis(cuerpo, args.cis_url, args.token)
    print(json.dumps(respuesta, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

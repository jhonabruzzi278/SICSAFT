"""Tests del ETL contable (DOC-029 RF-B). `pytest herramientas/etl-contable`."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import etl_contable as etl


@pytest.fixture
def excel_cliente(tmp_path: Path) -> Path:
    """Excel con la forma real: 4 filas de basura, encabezado en la 5ta, celdas combinadas."""
    filas = [
        [None] * 8,
        [None] * 8,
        ["CU-PAT - Gestion Patrimonial", None, None, None, None, None, None, None],
        [None] * 8,
        [
            "No.",
            "DIRECCION",
            "CODIGO",
            "NOMBRE AFT",
            "CATEGORIA",
            "AREA",
            "RESPONSABLE",
            "VALOR.CLP.",
        ],
        [
            1,
            "DIRECCION GENERAL",
            "DG-001",
            "1 MESA BURO",
            "MOBILIARIO",
            "OFICINA DIRECTOR",
            "DIRECTOR GENERAL",
            "$850.000",
        ],
        [2, None, "DG-002", "1 SILLA GIRATORIA", "MOBILIARIO", None, None, "120000"],
        [3, None, "dg-003", "1 PC ESCRITORIO", "INFORMATICA", None, None, None],
        [None, None, None, None, None, None, None, None],
        [
            4,
            "JURIDICO",
            "JU 001",
            "1 IMPRESORA",
            "INFORMATICA",
            "OFICINA ABOGADO",
            "ABOGADO PRINCIPAL",
            "1.234.567,50",
        ],
    ]
    ruta = tmp_path / "activos.xlsx"
    pd.DataFrame(filas).to_excel(ruta, header=False, index=False, engine="openpyxl")
    return ruta


def test_normalizar_valor():
    assert etl.normalizar_valor("$850.000") == 850000.0
    assert etl.normalizar_valor("120000") == 120000.0
    assert etl.normalizar_valor("1.234.567,50") == 1234567.5
    assert etl.normalizar_valor("1234,5") == 1234.5
    assert etl.normalizar_valor("") is None
    assert etl.normalizar_valor(None) is None
    assert etl.normalizar_valor("nan") is None
    assert etl.normalizar_valor("no es plata") is None
    assert etl.normalizar_valor("-5") is None  # negativo -> None


def test_acunar_qr():
    assert etl.acunar_qr(" dg-001 ") == "DG-001"


def test_procesar_normaliza_encabezado_fill_down_y_filas(excel_cliente: Path):
    cuerpo = etl.procesar(excel_cliente, "muni", etl.MAPEO_POR_DEFECTO)

    assert cuerpo["organizacionId"] == "muni"
    assert cuerpo["origen"] == "carpeta"
    assert cuerpo["archivoNombre"] == "activos.xlsx"

    filas = cuerpo["filas"]
    # 4 activos con código; la fila totalmente vacía se descarta.
    assert [f["codigoPatrimonial"] for f in filas] == ["DG-001", "DG-002", "dg-003", "JU 001"]

    # fill-down de DIRECCION / AREA / RESPONSABLE.
    assert filas[1]["direccionNombre"] == "DIRECCION GENERAL"
    assert filas[1]["areaNombre"] == "OFICINA DIRECTOR"
    assert filas[1]["responsableNombre"] == "DIRECTOR GENERAL"
    # la nueva dirección corta el fill-down.
    assert filas[3]["direccionNombre"] == "JURIDICO"

    # codigoQr acuñado y en mayúsculas.
    assert filas[2]["codigoQr"] == "DG-003"

    # valores numéricos parseados; fila sin valor no lleva la clave.
    assert filas[0]["valorPatrimonial"] == 850000.0
    assert filas[3]["valorPatrimonial"] == 1234567.5
    assert "valorPatrimonial" not in filas[2]

    # categoría siempre presente (el schema de CORE exige catalogoId o categoriaNombre).
    assert all(f["categoriaNombre"] for f in filas)
    # `crudo` guarda las columnas originales no vacías.
    assert filas[0]["crudo"]["CODIGO"] == "DG-001"


def test_procesar_sin_encabezado_falla(tmp_path: Path):
    ruta = tmp_path / "raro.xlsx"
    pd.DataFrame([["a", "b"], ["c", "d"]]).to_excel(
        ruta, header=False, index=False, engine="openpyxl"
    )
    with pytest.raises(ValueError, match="fila de encabezado"):
        etl.procesar(ruta, "muni", etl.MAPEO_POR_DEFECTO)


def test_procesar_sin_filas_con_codigo_falla(tmp_path: Path):
    ruta = tmp_path / "vacio.xlsx"
    pd.DataFrame([["No.", "CODIGO", "CATEGORIA"], [None, None, None]]).to_excel(
        ruta, header=False, index=False, engine="openpyxl"
    )
    with pytest.raises(ValueError, match="0 filas"):
        etl.procesar(ruta, "muni", etl.MAPEO_POR_DEFECTO)


def test_cargar_mapeo_mezcla_con_el_por_defecto(tmp_path: Path):
    ruta = tmp_path / "mapeo-muni.json"
    ruta.write_text('{"marcador_encabezado": "COD."}', encoding="utf-8")
    mapeo = etl.cargar_mapeo(ruta)
    assert mapeo["marcador_encabezado"] == "COD."
    assert mapeo["columnas"]["CODIGO"] == "codigoPatrimonial"  # del default


def test_cargar_mapeo_none_devuelve_default():
    assert etl.cargar_mapeo(None) is etl.MAPEO_POR_DEFECTO


def test_main_salida_stdout(excel_cliente: Path, capsys: pytest.CaptureFixture[str]):
    codigo = etl.main(["--entrada", str(excel_cliente), "--organizacion", "muni", "--salida", "-"])
    assert codigo == 0
    salida = capsys.readouterr().out
    assert '"organizacionId": "muni"' in salida
    assert "DG-001" in salida


def test_main_sin_destino_falla(excel_cliente: Path):
    with pytest.raises(SystemExit):
        etl.main(["--entrada", str(excel_cliente), "--organizacion", "muni"])


def test_enviar_a_cis_ok(monkeypatch: pytest.MonkeyPatch):
    llamadas: dict[str, object] = {}

    class RespFake:
        status_code = 200

        @staticmethod
        def json() -> dict[str, str]:
            return {"loteId": "lote-1"}

    def post_fake(url: str, json: dict, headers: dict, timeout: int):
        llamadas.update(url=url, json=json, headers=headers)
        return RespFake()

    import requests

    monkeypatch.setattr(requests, "post", post_fake)
    resultado = etl.enviar_a_cis({"x": 1}, "http://cis:56000/", "jwt-123")

    assert resultado == {"loteId": "lote-1"}
    assert llamadas["url"] == "http://cis:56000/admin/importaciones/contable/lote"
    assert llamadas["headers"]["Authorization"] == "Bearer jwt-123"


def test_enviar_a_cis_error(monkeypatch: pytest.MonkeyPatch):
    class RespFake:
        status_code = 403
        text = "sin rol"

    import requests

    monkeypatch.setattr(requests, "post", lambda *a, **k: RespFake())
    with pytest.raises(SystemExit, match="403"):
        etl.enviar_a_cis({}, "http://cis", "jwt")

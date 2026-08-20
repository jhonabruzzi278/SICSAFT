import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cisClient,
  CisApiError,
  type FilaImportacionContable,
  type ResultadoImportacionContable,
} from '@/lib/cis-client';
import { Alert, Badge, Button, Card } from '@/components/ui';

// RF-14 (DOC-021, gap "importaciones controladas") — POST /importaciones/contable ya existía en
// CORE desde DOC-012 6, sin puente en CIS ni UI en WEB. Parseo de CSV cliente-side con un parser
// mínimo propio (sin dependencia nueva — mismo criterio ya declarado en ccp/README.md de
// minimizar dependencias del primer incremento; el formato es controlado, no hace falta manejar
// comillas/escapes de CSV genérico).

const COLUMNAS_REQUERIDAS = [
  'codigoPatrimonial',
  'codigoQr',
  'catalogoId',
] as const;
const COLUMNAS_OPCIONALES = [
  'serie',
  'responsableId',
  'areaId',
  'ubicacionId',
  'valorPatrimonial',
] as const;

function parsearCsv(texto: string): FilaImportacionContable[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lineas.length < 2) {
    throw new Error(
      'El archivo necesita una fila de encabezados y al menos una fila de datos.',
    );
  }
  const encabezados = lineas[0].split(',').map((h) => h.trim());
  for (const columna of COLUMNAS_REQUERIDAS) {
    if (!encabezados.includes(columna)) {
      throw new Error(
        `Falta la columna requerida '${columna}' en el encabezado.`,
      );
    }
  }

  return lineas.slice(1).map((linea, indice) => {
    const valores = linea.split(',').map((v) => v.trim());
    const fila: Record<string, string> = {};
    encabezados.forEach((encabezado, i) => {
      fila[encabezado] = valores[i] ?? '';
    });
    for (const columna of COLUMNAS_REQUERIDAS) {
      if (!fila[columna]) {
        throw new Error(`Fila ${indice + 2}: falta '${columna}'.`);
      }
    }
    const resultado: FilaImportacionContable = {
      codigoPatrimonial: fila.codigoPatrimonial,
      codigoQr: fila.codigoQr,
      catalogoId: fila.catalogoId,
    };
    for (const columna of COLUMNAS_OPCIONALES) {
      const valor = fila[columna];
      if (!valor) continue;
      if (columna === 'valorPatrimonial') {
        resultado.valorPatrimonial = Number(valor);
      } else {
        resultado[columna] = valor;
      }
    }
    return resultado;
  });
}

export function ImportacionesPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filas, setFilas] = useState<FilaImportacionContable[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultado, setResultado] =
    useState<ResultadoImportacionContable | null>(null);
  const [enviando, setEnviando] = useState(false);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setResultado(null);
    file
      .text()
      .then((texto) => {
        setFilas(parsearCsv(texto));
      })
      .catch((err: unknown) => {
        setFilas(null);
        setParseError(
          err instanceof Error ? err.message : 'No se pudo leer el archivo.',
        );
      });
  }

  async function confirmarImportacion() {
    if (!filas) return;
    setSubmitError(null);
    setEnviando(true);
    try {
      const res = await cisClient.importarContable(organizacionId, filas);
      setResultado(res);
      setFilas(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      if (err instanceof CisApiError && err.status === 403) {
        setSubmitError(
          'No tenés el rol administrador-patrimonial en esta organización.',
        );
      } else {
        setSubmitError(
          err instanceof Error ? err.message : 'Error desconocido',
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-accent-strong">
        Importaciones controladas
      </h1>
      <p className="text-sm text-text-dim">
        Archivo CSV con encabezados:{' '}
        <code>codigoPatrimonial, codigoQr, catalogoId</code> (requeridos) y
        opcionalmente{' '}
        <code>serie, responsableId, areaId, ubicacionId, valorPatrimonial</code>
        . Idempotente por fila — reimportar la misma fila sin cambios no la
        duplica.
      </p>

      <Card>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="block w-full text-sm text-text-dim file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-bg hover:file:bg-accent-strong"
        />
        {parseError && (
          <div className="mt-4">
            <Alert>{parseError}</Alert>
          </div>
        )}
      </Card>

      {filas && filas.length > 0 && (
        <Card>
          <h2 className="mb-4 font-medium text-text">
            Vista previa — {filas.length}{' '}
            {filas.length === 1 ? 'fila' : 'filas'}
          </h2>
          <div className="mb-4 max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-3 py-1.5 font-medium">
                    Código patrimonial
                  </th>
                  <th className="px-3 py-1.5 font-medium">Código QR</th>
                  <th className="px-3 py-1.5 font-medium">Catálogo</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr
                    key={fila.codigoPatrimonial}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-1.5 font-mono">
                      {fila.codigoPatrimonial}
                    </td>
                    <td className="px-3 py-1.5 font-mono">{fila.codigoQr}</td>
                    <td className="px-3 py-1.5">{fila.catalogoId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {submitError && <Alert>{submitError}</Alert>}
          <Button
            disabled={enviando}
            onClick={() => void confirmarImportacion()}
          >
            {enviando
              ? 'Importando…'
              : `Confirmar importación de ${filas.length} filas`}
          </Button>
        </Card>
      )}

      {resultado && (
        <Card>
          <h2 className="mb-4 font-medium text-text">Resultado</h2>
          <p className="mb-4 text-sm text-text-dim">
            {resultado.creados} creados, {resultado.yaImportados} ya importados,{' '}
            {resultado.conflictos} conflictos.
          </p>
          <ul className="space-y-1 text-sm">
            {resultado.filas.map((fila) => (
              <li
                key={fila.codigoPatrimonial}
                className="flex items-center gap-2"
              >
                <span className="font-mono text-xs">
                  {fila.codigoPatrimonial}
                </span>
                <Badge>{fila.resultado}</Badge>
                {fila.resultado === 'conflicto' && (
                  <span className="text-xs text-text-dim">{fila.motivo}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

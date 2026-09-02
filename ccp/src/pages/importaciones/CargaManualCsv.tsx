import { useRef, useState } from 'react';
import {
  cisClient,
  CisApiError,
  type FilaImportacionContable,
  type ResultadoImportacionContable,
} from '@/lib/cis-client';
import { parsearCsv } from '@/lib/importacion-csv';
import { Alert, Badge, Button, Card } from '@/components/ui';

// DOC-012 6 (gap "importaciones controladas") — carga manual puntual de un CSV con IDs ya
// resueltos. No pasa por la bandeja de staging (decisión del usuario, DOC-029 RF-B B.6): el AFT
// que sube el CSV a mano ya es el humano que revisa, en ese acto. El parser vive en
// @/lib/importacion-csv (testeable).

export function CargaManualCsv({ organizacionId }: { organizacionId: string }) {
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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium text-text">Carga manual (CSV)</h2>
        <p className="mt-1 text-sm text-text-dim">
          Archivo CSV con encabezados{' '}
          <code>codigoPatrimonial, codigoQr, catalogoId</code> (requeridos) y
          opcionalmente{' '}
          <code>
            serie, responsableId, areaId, ubicacionId, valorPatrimonial
          </code>
          . Idempotente por fila — reimportar la misma fila sin cambios no la
          duplica.
        </p>
      </div>

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
          <h3 className="mb-4 font-medium text-text">
            Vista previa — {filas.length}{' '}
            {filas.length === 1 ? 'fila' : 'filas'}
          </h3>
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
          <h3 className="mb-4 font-medium text-text">Resultado</h3>
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
    </section>
  );
}

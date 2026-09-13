// Contrato tipado entre preload y renderer (mismo patrón que sicsaft-core/src/shared/ipc-contract.ts
// y ccp-desktop/src/shared/ipc-contract.ts: el renderer sandboxeado nunca llama un canal mal
// escrito sin que TypeScript lo marque).

// Fila canónica que imprime `etl_contable.py --salida -` (ver herramientas/etl-contable/
// etl_contable.py `construir_filas()`). Esta herramienta solo lee los campos que necesita para
// armar la hoja de etiquetas -- el resto del objeto (categoriaNombre, responsableNombre, crudo,
// etc.) viaja igual en el JSON pero no se tipa acá porque no se usa.
export interface FilaEtl {
  linea: number;
  codigoPatrimonial: string;
  codigoQr: string;
  nombreAft?: string;
  direccionNombre?: string;
  departamentoNombre?: string;
  areaNombre?: string;
}

export interface CuerpoEtl {
  organizacionId: string;
  origen: string;
  archivoNombre: string | null;
  filas: FilaEtl[];
}

export interface GenerarInput {
  rutaExcel: string;
  organizacionId: string;
  rutaMapeo?: string;
}

export interface GenerarResultado {
  ok: true;
  cuerpo: CuerpoEtl;
}

export interface GenerarError {
  ok: false;
  mensaje: string;
}

export interface GeneradorQrApi {
  elegirExcel: () => Promise<string | null>;
  elegirMapeo: () => Promise<string | null>;
  generar: (input: GenerarInput) => Promise<GenerarResultado | GenerarError>;
}

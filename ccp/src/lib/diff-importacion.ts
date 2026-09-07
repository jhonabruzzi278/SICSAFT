import type {
  ActivoCatalogo,
  Area,
  FilaImportacionContable,
} from './cis-client';

// Mejora 6 — Ingesta de planillas Excel/CSV/TSV con Diff Visual interactivo previo a la importación.
// Normaliza delimitadores (coma, punto y coma, tabulación) y cabeceras en español / inglés.
// Cruza contra la Base Patrimonial existente (BPI) para clasificar cada fila en:
//  - 'nuevo': alta patrimonial no existente
//  - 'actualizacion': activo existente con cambios en área, ubicación o responsable
//  - 'identico': activo ya registrado sin modificaciones (idempotente)
//  - 'conflicto': discrepancia de QR, duplicados en archivo o datos incompletos

export type TipoDiff = 'nuevo' | 'actualizacion' | 'identico' | 'conflicto';

export interface ItemDiffImportacion {
  indice: number;
  fila: FilaImportacionContable;
  tipo: TipoDiff;
  cambios: string[];
  motivoConflicto?: string;
  activoPrevio?: ActivoCatalogo;
}

export interface ResumenDiffImportacion {
  total: number;
  nuevos: number;
  actualizaciones: number;
  identicos: number;
  conflictos: number;
}

const MAPA_ALIAS_CABECERAS: Record<string, keyof FilaImportacionContable> = {
  codigopatrimonial: 'codigoPatrimonial',
  codigo_patrimonial: 'codigoPatrimonial',
  cod_patrimonial: 'codigoPatrimonial',
  patrimonio: 'codigoPatrimonial',
  codigo: 'codigoPatrimonial',

  codigoqr: 'codigoQr',
  codigo_qr: 'codigoQr',
  cod_qr: 'codigoQr',
  qr: 'codigoQr',

  catalogoid: 'catalogoId',
  catalogo_id: 'catalogoId',
  catalogo: 'catalogoId',
  tipo_activo: 'catalogoId',
  tipo: 'catalogoId',

  serie: 'serie',
  numero_serie: 'serie',
  n_serie: 'serie',
  serial: 'serie',

  areaid: 'areaId',
  area_id: 'areaId',
  area: 'areaId',

  ubicacionid: 'ubicacionId',
  ubicacion_id: 'ubicacionId',
  ubicacion: 'ubicacionId',

  responsableid: 'responsableId',
  responsable_id: 'responsableId',
  responsable: 'responsableId',
  custodio: 'responsableId',

  valorpatrimonial: 'valorPatrimonial',
  valor_patrimonial: 'valorPatrimonial',
  valor: 'valorPatrimonial',
  costo: 'valorPatrimonial',
  precio: 'valorPatrimonial',
};

function detectarDelimitador(lineaEncabezado: string): string {
  const comas = (lineaEncabezado.match(/,/g) || []).length;
  const puntoComas = (lineaEncabezado.match(/;/g) || []).length;
  const tabs = (lineaEncabezado.match(/\t/g) || []).length;

  if (tabs > comas && tabs > puntoComas) return '\t';
  if (puntoComas > comas) return ';';
  return ',';
}

function normalizarClave(clave: string): string {
  return clave
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function parsearPlanillaFlexible(
  texto: string,
): FilaImportacionContable[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lineas.length < 2) {
    throw new Error(
      'El archivo debe contener una fila de encabezados y al menos una fila de datos.',
    );
  }

  const delimitador = detectarDelimitador(lineas[0]);
  const cabecerasOriginales = lineas[0]
    .split(delimitador)
    .map((c) => c.trim().replace(/^["']|["']$/g, ''));

  const mapeoIndices = new Map<number, keyof FilaImportacionContable>();
  for (let i = 0; i < cabecerasOriginales.length; i++) {
    const raw = cabecerasOriginales[i];
    const normal = normalizarClave(raw);
    const campo = MAPA_ALIAS_CABECERAS[normal];
    if (campo) {
      mapeoIndices.set(i, campo);
    }
  }

  // Verificar campos obligatorios
  const camposEncontrados = new Set(mapeoIndices.values());
  const requeridos: Array<keyof FilaImportacionContable> = [
    'codigoPatrimonial',
    'codigoQr',
    'catalogoId',
  ];
  for (const req of requeridos) {
    if (!camposEncontrados.has(req)) {
      throw new Error(
        `Falta la columna obligatoria '${req}' (o sus variantes: código, QR, catálogo).`,
      );
    }
  }

  const filas: FilaImportacionContable[] = [];

  for (let l = 1; l < lineas.length; l++) {
    const valores = lineas[l]
      .split(delimitador)
      .map((v) => v.trim().replace(/^["']|["']$/g, ''));
    if (valores.every((v) => v.length === 0)) continue;

    const fila: Partial<FilaImportacionContable> = {};
    for (let i = 0; i < valores.length; i++) {
      const campo = mapeoIndices.get(i);
      if (!campo) continue;
      const valor = valores[i] ?? '';
      if (!valor) continue;

      if (campo === 'valorPatrimonial') {
        const num = Number(valor.replace(/\./g, '').replace(/,/g, '.'));
        if (!Number.isNaN(num)) fila.valorPatrimonial = num;
      } else {
        fila[campo] = valor as never;
      }
    }

    if (!fila.codigoPatrimonial || !fila.codigoQr || !fila.catalogoId) {
      throw new Error(
        `Fila ${l + 1}: faltan datos obligatorios (código, QR o catálogo).`,
      );
    }

    filas.push(fila as FilaImportacionContable);
  }

  return filas;
}

export function calcularDiffImportacion(
  filas: readonly FilaImportacionContable[],
  catalogoActual: readonly ActivoCatalogo[],
  areas: readonly Area[] = [],
): { items: ItemDiffImportacion[]; resumen: ResumenDiffImportacion } {
  const activosPorCodigo = new Map<string, ActivoCatalogo>();
  const activosPorQr = new Map<string, ActivoCatalogo>();
  const areaPorId = new Map(areas.map((a) => [a.id, a.nombre]));

  for (const a of catalogoActual) {
    activosPorCodigo.set(a.id, a);
    activosPorQr.set(a.codigoQr, a);
  }

  const codigosVistos = new Set<string>();
  const qrVistos = new Set<string>();

  const items: ItemDiffImportacion[] = [];
  let nuevos = 0;
  let actualizaciones = 0;
  let identicos = 0;
  let conflictos = 0;

  for (let idx = 0; idx < filas.length; idx++) {
    const fila = filas[idx];
    const codigo = fila.codigoPatrimonial;
    const qr = fila.codigoQr;

    // Chequeo de duplicados internos dentro del mismo archivo
    if (codigosVistos.has(codigo)) {
      conflictos += 1;
      items.push({
        indice: idx + 1,
        fila,
        tipo: 'conflicto',
        cambios: [],
        motivoConflicto: `Código patrimonial duplicado dentro del archivo: ${codigo}`,
      });
      continue;
    }
    if (qrVistos.has(qr)) {
      conflictos += 1;
      items.push({
        indice: idx + 1,
        fila,
        tipo: 'conflicto',
        cambios: [],
        motivoConflicto: `Código QR duplicado dentro del archivo: ${qr}`,
      });
      continue;
    }
    codigosVistos.add(codigo);
    qrVistos.add(qr);

    // Buscar en catálogo existente
    const previoPorCodigo = activosPorCodigo.get(codigo);
    const previoPorQr = activosPorQr.get(qr);

    // Conflicto de colisión cruzada (ej. el QR pertenece a otro código en la BPI)
    if (previoPorQr && previoPorQr.id !== codigo) {
      conflictos += 1;
      items.push({
        indice: idx + 1,
        fila,
        tipo: 'conflicto',
        cambios: [],
        motivoConflicto: `El código QR '${qr}' ya está asignado al activo '${previoPorQr.id}' en la BPI.`,
        activoPrevio: previoPorQr,
      });
      continue;
    }

    if (!previoPorCodigo) {
      // No existe en la BPI -> Alta Nueva
      nuevos += 1;
      items.push({
        indice: idx + 1,
        fila,
        tipo: 'nuevo',
        cambios: ['Alta patrimonial nueva'],
      });
      continue;
    }

    // El activo ya existe en la BPI -> Comparar campos para detectar si hay cambios o si es idéntico
    const cambios: string[] = [];

    if (fila.areaId && fila.areaId !== previoPorCodigo.areaId) {
      const nomAnt =
        areaPorId.get(previoPorCodigo.areaId) ?? previoPorCodigo.areaId;
      const nomNuevo = areaPorId.get(fila.areaId) ?? fila.areaId;
      cambios.push(`Reubicación de Área: '${nomAnt}' ➔ '${nomNuevo}'`);
    }

    if (fila.ubicacionId && fila.ubicacionId !== previoPorCodigo.ubicacionId) {
      cambios.push(
        `Cambio de Ubicación: '${previoPorCodigo.ubicacionId}' ➔ '${fila.ubicacionId}'`,
      );
    }

    if (cambios.length > 0) {
      actualizaciones += 1;
      items.push({
        indice: idx + 1,
        fila,
        tipo: 'actualizacion',
        cambios,
        activoPrevio: previoPorCodigo,
      });
    } else {
      identicos += 1;
      items.push({
        indice: idx + 1,
        fila,
        tipo: 'identico',
        cambios: ['Sin modificaciones (idéntico a la BPI)'],
        activoPrevio: previoPorCodigo,
      });
    }
  }

  const resumen: ResumenDiffImportacion = {
    total: filas.length,
    nuevos,
    actualizaciones,
    identicos,
    conflictos,
  };

  return { items, resumen };
}

export function generarPlantillaCsvEjemplo(): string {
  return [
    'codigoPatrimonial,codigoQr,catalogoId,serie,areaId,ubicacionId,valorPatrimonial',
    'NOTE-001,QR-NOTE-001,catalogo-notebook,SN123456,area-informatica,ubi-piso-2,850000',
    'NOTE-002,QR-NOTE-002,catalogo-notebook,SN123457,area-informatica,ubi-piso-2,850000',
    'MON-001,QR-MON-001,catalogo-monitor,SN987654,area-administracion,ubi-oficina-1,180000',
  ].join('\n');
}

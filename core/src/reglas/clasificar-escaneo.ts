import type { Activo } from '../patrimonial/activo.types';
import type { ScanResultado } from './reglas.types';

// Mismo patron que ASSET_CODE_PATTERN de app-qr-sicsaft/src/lib/scan-resolve.ts — un codigo
// valido es alfanumerico en mayusculas, con un guion opcional (variante BASE-VARIANTE).
const CODIGO_QR_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)?$/;

export interface ClasificarEscaneoInput {
  codigoQr: string;
  // El activo ya viene resuelto y acotado a la organizacion de la sesion (ActivoRepository) —
  // null cubre tanto "no existe" como "existe en otra organizacion" (DOC-008).
  activo: Activo | null;
  // DOC-009 §2: casi siempre false — activos.codigo_qr es UNIQUE. Solo puede dar true si una
  // importacion masiva (Fase 7) inserta datos sin pasar por esa validacion.
  duplicado: boolean;
  yaClasificados: ReadonlySet<string>;
  sesionAreaId: string;
  sesionUbicacionId: string;
  tieneIncidencia: boolean;
}

// DOC-009 — funcion pura, sin acceso a base de datos. Arbol de decision identico al de
// app-qr-sicsaft/src/lib/scan-resolve.ts, mas la rama `duplicado` que solo CORE puede resolver
// contra la Base Patrimonial real.
export function clasificarEscaneo(
  input: ClasificarEscaneoInput,
): ScanResultado {
  if (!CODIGO_QR_PATTERN.test(input.codigoQr)) {
    return 'invalido';
  }
  if (input.yaClasificados.has(input.codigoQr)) {
    return 'ya_escaneado';
  }
  if (input.duplicado) {
    return 'duplicado';
  }
  if (!input.activo) {
    return 'no_registrado';
  }
  if (input.activo.areaId !== input.sesionAreaId) {
    return 'otra_area';
  }
  if (input.activo.ubicacionId !== input.sesionUbicacionId) {
    return 'otra_ubicacion';
  }
  if (input.tieneIncidencia) {
    return 'con_incidencia';
  }
  return 'correcto';
}

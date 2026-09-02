// DOC-029 RF-B — helpers puros de la bandeja de staging de ingesta de Excel. La UI vive en
// src/pages/importaciones/; acá solo la lógica testeable (mismo criterio que nivel.ts / lib/oidc).
import type {
  DryRunResultado,
  FilaLoteImportacionContable,
  LoteImportacionContable,
} from './cis-client';

export const ETIQUETA_DRY_RUN: Record<DryRunResultado, string> = {
  crear: 'Crear',
  ya_importado: 'Ya importado',
  conflicto: 'Conflicto',
};

export interface ConteoDryRun {
  crear: number;
  ya_importado: number;
  conflicto: number;
  sinEvaluar: number;
}

// Cuenta las filas de un lote por resultado de dry-run. `null` = todavía sin evaluar (no debería
// pasar en un lote ya recibido, pero la UI no asume).
export function contarDryRun(
  filas: readonly Pick<FilaLoteImportacionContable, 'dryRunResultado'>[],
): ConteoDryRun {
  const conteo: ConteoDryRun = {
    crear: 0,
    ya_importado: 0,
    conflicto: 0,
    sinEvaluar: 0,
  };
  for (const fila of filas) {
    if (fila.dryRunResultado === null) conteo.sinEvaluar += 1;
    else conteo[fila.dryRunResultado] += 1;
  }
  return conteo;
}

// Solo un lote pendiente de revisión se puede aprobar o rechazar — uno ya resuelto es inmutable.
export function loteAccionable(
  lote: Pick<LoteImportacionContable, 'estado'>,
): boolean {
  return lote.estado === 'pendiente_revision';
}

// Orden de la bandeja: los pendientes de revisión primero, después por fecha de recepción
// descendente (el más nuevo arriba).
export function ordenarLotes(
  lotes: readonly LoteImportacionContable[],
): LoteImportacionContable[] {
  return [...lotes].sort((a, b) => {
    const aPend = a.estado === 'pendiente_revision';
    const bPend = b.estado === 'pendiente_revision';
    if (aPend !== bPend) return aPend ? -1 : 1;
    return b.recibidoEn.localeCompare(a.recibidoEn);
  });
}

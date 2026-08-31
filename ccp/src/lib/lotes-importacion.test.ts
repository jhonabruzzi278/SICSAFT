import { describe, expect, it } from 'vitest';
import {
  contarDryRun,
  loteAccionable,
  ordenarLotes,
} from './lotes-importacion';
import type { LoteImportacionContable } from './cis-client';

function lote(
  over: Partial<LoteImportacionContable> = {},
): LoteImportacionContable {
  return {
    id: 'l1',
    organizacionId: 'org',
    origen: 'carpeta',
    archivoNombre: 'activos.xls',
    recibidoEn: '2026-08-31T10:00:00.000Z',
    estado: 'pendiente_revision',
    revisadoPor: null,
    revisadoEn: null,
    motivoRechazo: null,
    resumen: { totalFilas: 0, crear: 0, yaImportado: 0, conflicto: 0 },
    ...over,
  };
}

describe('contarDryRun', () => {
  it('cuenta por resultado y trata null como sin evaluar', () => {
    const conteo = contarDryRun([
      { dryRunResultado: 'crear' },
      { dryRunResultado: 'crear' },
      { dryRunResultado: 'ya_importado' },
      { dryRunResultado: 'conflicto' },
      { dryRunResultado: null },
    ]);
    expect(conteo).toEqual({
      crear: 2,
      ya_importado: 1,
      conflicto: 1,
      sinEvaluar: 1,
    });
  });

  it('devuelve todo en cero para una lista vacía', () => {
    expect(contarDryRun([])).toEqual({
      crear: 0,
      ya_importado: 0,
      conflicto: 0,
      sinEvaluar: 0,
    });
  });
});

describe('loteAccionable', () => {
  it('solo un lote pendiente_revision se puede aprobar/rechazar', () => {
    expect(loteAccionable({ estado: 'pendiente_revision' })).toBe(true);
    expect(loteAccionable({ estado: 'aprobado' })).toBe(false);
    expect(loteAccionable({ estado: 'rechazado' })).toBe(false);
  });
});

describe('ordenarLotes', () => {
  it('pone los pendientes primero y dentro de cada grupo el más nuevo arriba', () => {
    const viejoPendiente = lote({
      id: 'a',
      estado: 'pendiente_revision',
      recibidoEn: '2026-08-30T09:00:00.000Z',
    });
    const nuevoPendiente = lote({
      id: 'b',
      estado: 'pendiente_revision',
      recibidoEn: '2026-08-31T09:00:00.000Z',
    });
    const nuevoAprobado = lote({
      id: 'c',
      estado: 'aprobado',
      recibidoEn: '2026-08-31T12:00:00.000Z',
    });

    const orden = ordenarLotes([
      nuevoAprobado,
      viejoPendiente,
      nuevoPendiente,
    ]).map((l) => l.id);

    expect(orden).toEqual(['b', 'a', 'c']);
  });

  it('no muta el arreglo recibido', () => {
    const entrada = [lote({ id: 'x' }), lote({ id: 'y' })];
    const copia = [...entrada];
    ordenarLotes(entrada);
    expect(entrada).toEqual(copia);
  });
});

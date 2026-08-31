import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportacionContableService } from './importacion-contable.service';
import {
  ImportacionContableLoteRepository,
  type FilaLoteParaCrear,
} from './importacion-contable-lote.repository';
import type { FilaImportacionContable } from './importacion-contable.types';
import type { ImportacionContableResultado } from './importacion-contable.types';
import type {
  DryRunFila,
  EstadoLote,
  FilaLoteImportacionContable,
  LoteConFilas,
  LoteImportacionContable,
  OrigenLote,
  ResumenLote,
} from './importacion-contable-lote.types';

// DOC-029 RF-B — orquesta la bandeja de staging: crear un lote calcula el dry-run de cada fila
// (sin escribir); aprobar ejecuta la importación real reusando ImportacionContableService.procesar
// (idempotente por fila, DOC-012 6) y cierra el lote; rechazar lo cierra sin tocar la Base
// Patrimonial. Invocado por OrquestadorService, no directo desde el controller.

export interface FilaLoteEntrada {
  linea: number;
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string;
  serie?: string;
  responsableId?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
  crudo: Record<string, string>;
}

const MOTIVO_DRY_RUN: Record<DryRunFila, string | null> = {
  crear: null,
  ya_importado: 'Ya está en la Base Patrimonial con el mismo contenido.',
  conflicto:
    'Ya existe un activo con ese código patrimonial y datos distintos — aprobar no lo sobrescribe.',
};

function aFilaCanonica(
  fila: FilaLoteEntrada | FilaLoteImportacionContable,
): FilaImportacionContable {
  return {
    codigoPatrimonial: fila.codigoPatrimonial,
    codigoQr: fila.codigoQr,
    catalogoId: fila.catalogoId,
    serie: fila.serie ?? undefined,
    responsableId: fila.responsableId ?? undefined,
    areaId: fila.areaId ?? undefined,
    ubicacionId: fila.ubicacionId ?? undefined,
    valorPatrimonial: fila.valorPatrimonial ?? undefined,
  };
}

@Injectable()
export class ImportacionContableLoteService {
  constructor(
    private readonly loteRepository: ImportacionContableLoteRepository,
    private readonly importacionContableService: ImportacionContableService,
  ) {}

  async crearLote(input: {
    organizacionId: string;
    origen: OrigenLote;
    archivoNombre?: string;
    filas: readonly FilaLoteEntrada[];
  }): Promise<{ loteId: string; resumen: ResumenLote }> {
    const filasParaCrear: FilaLoteParaCrear[] = [];
    for (const fila of input.filas) {
      const dryRunResultado = await this.importacionContableService.evaluarFila(
        input.organizacionId,
        aFilaCanonica(fila),
      );
      filasParaCrear.push({
        ...fila,
        crudo: fila.crudo,
        dryRunResultado,
        dryRunMotivo: MOTIVO_DRY_RUN[dryRunResultado],
      });
    }
    return this.loteRepository.crear({
      organizacionId: input.organizacionId,
      origen: input.origen,
      archivoNombre: input.archivoNombre ?? null,
      filas: filasParaCrear,
    });
  }

  listarLotes(
    organizacionId: string,
    estado?: EstadoLote,
  ): Promise<LoteImportacionContable[]> {
    return this.loteRepository.listar(organizacionId, estado);
  }

  async obtenerLote(loteId: string): Promise<LoteConFilas> {
    const lote = await this.loteRepository.obtener(loteId);
    if (!lote) {
      throw new NotFoundException(`Lote de importación '${loteId}' no existe.`);
    }
    return lote;
  }

  async aprobarLote(
    loteId: string,
    operadorId: string,
  ): Promise<ImportacionContableResultado> {
    const { lote, filas } = await this.cargarPendiente(loteId);
    const resultado = await this.importacionContableService.procesar(
      lote.organizacionId,
      filas.map(aFilaCanonica),
      operadorId,
    );
    await this.loteRepository.marcarRevisado(
      loteId,
      'aprobado',
      operadorId,
      null,
    );
    return resultado;
  }

  async rechazarLote(
    loteId: string,
    operadorId: string,
    motivo?: string,
  ): Promise<void> {
    await this.cargarPendiente(loteId);
    await this.loteRepository.marcarRevisado(
      loteId,
      'rechazado',
      operadorId,
      motivo ?? null,
    );
  }

  // Un lote solo se aprueba o rechaza una vez — un segundo intento sobre un lote ya cerrado es un
  // 409, no reejecuta la importación ni reescribe el revisor.
  private async cargarPendiente(loteId: string): Promise<LoteConFilas> {
    const lote = await this.obtenerLote(loteId);
    if (lote.lote.estado !== 'pendiente_revision') {
      throw new ConflictException(
        `El lote '${loteId}' ya fue ${lote.lote.estado === 'aprobado' ? 'aprobado' : 'rechazado'}.`,
      );
    }
    return lote;
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportacionContableService } from './importacion-contable.service';
import { ResolvedorImportacionService } from './resolvedor-importacion.service';
import {
  ImportacionContableLoteRepository,
  type FilaLoteParaCrear,
} from './importacion-contable-lote.repository';
import type {
  FilaImportacionContable,
  ImportacionContableResultado,
} from './importacion-contable.types';
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
// (sin escribir); aprobar resuelve-o-crea la estructura que falte (área/responsable/catálogo por
// nombre, ver ResolvedorImportacionService) y ejecuta la importación real reusando
// ImportacionContableService.procesar (idempotente por fila, DOC-012 6); rechazar cierra el lote
// sin tocar la Base Patrimonial. Invocado por OrquestadorService, no directo desde el controller.

export interface FilaLoteEntrada {
  linea: number;
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId?: string;
  serie?: string;
  responsableId?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
  direccionNombre?: string;
  areaNombre?: string;
  responsableNombre?: string;
  categoriaNombre?: string;
  nombreAft?: string;
  crudo: Record<string, string>;
}

const MOTIVO_DRY_RUN: Record<DryRunFila, string | null> = {
  crear: null,
  ya_importado: 'Ya está en la Base Patrimonial con el mismo contenido.',
  conflicto:
    'Ya existe un activo con ese código patrimonial y datos distintos — aprobar no lo sobrescribe.',
};

@Injectable()
export class ImportacionContableLoteService {
  constructor(
    private readonly loteRepository: ImportacionContableLoteRepository,
    private readonly importacionContableService: ImportacionContableService,
    private readonly resolvedor: ResolvedorImportacionService,
  ) {}

  async crearLote(input: {
    organizacionId: string;
    origen: OrigenLote;
    archivoNombre?: string;
    filas: readonly FilaLoteEntrada[];
  }): Promise<{ loteId: string; resumen: ResumenLote }> {
    const filasParaCrear: FilaLoteParaCrear[] = [];
    for (const fila of input.filas) {
      // Dry-run: solo depende de si el codigoPatrimonial ya existe (evaluarFila no usa catalogoId
      // ni los nombres). El resolve-o-crea real ocurre al aprobar.
      const dryRunResultado = await this.importacionContableService.evaluarFila(
        input.organizacionId,
        {
          codigoPatrimonial: fila.codigoPatrimonial,
          codigoQr: fila.codigoQr,
          catalogoId: fila.catalogoId ?? '',
          serie: fila.serie,
          responsableId: fila.responsableId,
          areaId: fila.areaId,
          ubicacionId: fila.ubicacionId,
          valorPatrimonial: fila.valorPatrimonial,
        },
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
    const canonicas: FilaImportacionContable[] = [];
    for (const fila of filas) {
      canonicas.push(await this.resolverFila(lote.organizacionId, fila));
    }
    const resultado = await this.importacionContableService.procesar(
      lote.organizacionId,
      canonicas,
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

  // DOC-029 §B.4 — de la fila de staging a una fila canónica lista para procesar: se usa el id ya
  // resuelto si vino, si no se resuelve-o-crea desde el nombre. El schema garantiza que cada fila
  // trae catalogoId o categoriaNombre.
  private async resolverFila(
    organizacionId: string,
    fila: FilaLoteImportacionContable,
  ): Promise<FilaImportacionContable> {
    const catalogoId =
      fila.catalogoId ??
      (await this.resolvedor.resolverCatalogo(fila.categoriaNombre as string));
    const areaId =
      fila.areaId ??
      (fila.areaNombre
        ? await this.resolvedor.resolverArea(
            organizacionId,
            fila.areaNombre,
            fila.direccionNombre,
          )
        : undefined);
    const responsableId =
      fila.responsableId ??
      (fila.responsableNombre && areaId
        ? await this.resolvedor.resolverResponsable(
            organizacionId,
            fila.responsableNombre,
            areaId,
          )
        : undefined);
    return {
      codigoPatrimonial: fila.codigoPatrimonial,
      codigoQr: fila.codigoQr,
      catalogoId,
      serie: fila.serie ?? undefined,
      responsableId,
      areaId,
      ubicacionId: fila.ubicacionId ?? undefined,
      valorPatrimonial: fila.valorPatrimonial ?? undefined,
    };
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

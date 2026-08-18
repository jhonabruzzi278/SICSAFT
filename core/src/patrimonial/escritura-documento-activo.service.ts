import { Injectable } from '@nestjs/common';
import { DocumentoActivoRepository } from './documento-activo.repository';
import type {
  DocumentoActivo,
  NuevoDocumentoActivoInput,
} from './documento-activo.types';

// DOC-021 3 — invocado por OrquestadorService (auditoria de alta/baja), no directo desde el
// controller — mismo criterio que EscrituraActivoService.
@Injectable()
export class EscrituraDocumentoActivoService {
  constructor(
    private readonly documentoActivoRepository: DocumentoActivoRepository,
  ) {}

  crear(input: NuevoDocumentoActivoInput): Promise<DocumentoActivo> {
    return this.documentoActivoRepository.crear(input);
  }

  eliminar(
    documentoId: string,
    activoId: string,
    organizacionId: string,
  ): Promise<void> {
    return this.documentoActivoRepository.eliminar(
      documentoId,
      activoId,
      organizacionId,
    );
  }
}

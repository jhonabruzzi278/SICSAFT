import { Injectable } from '@nestjs/common';
import { ActivoRepository } from './activo.repository';
import { EventoRepository } from '../eventos/evento.repository';
import type { Activo } from './activo.types';
import type {
  FilaImportacionContable,
  ImportacionContableResultado,
  ResultadoFila,
} from './importacion-contable.types';

// DOC-012 6 — carga masiva de base contable, precursor manual de CON-CONTABILIDAD (Fase 7).
// Idempotente POR FILA (no por request completo, a diferencia de InventariosService que es
// atomico por sesion): cada fila se resuelve independiente, así una fila con datos invalidos no
// aborta el resto del archivo. Invocado por OrquestadorService, no directo desde el controller
// (mismo criterio que EscrituraActivoService).
@Injectable()
export class ImportacionContableService {
  constructor(
    private readonly activoRepository: ActivoRepository,
    private readonly eventoRepository: EventoRepository,
  ) {}

  async procesar(
    organizacionId: string,
    filas: readonly FilaImportacionContable[],
    operadorId: string,
  ): Promise<ImportacionContableResultado> {
    const resultados: ResultadoFila[] = [];
    for (const fila of filas) {
      resultados.push(
        await this.procesarFila(organizacionId, fila, operadorId),
      );
    }
    return {
      filas: resultados,
      creados: resultados.filter((r) => r.resultado === 'creado').length,
      yaImportados: resultados.filter((r) => r.resultado === 'ya_importado')
        .length,
      conflictos: resultados.filter((r) => r.resultado === 'conflicto').length,
    };
  }

  // DOC-029 RF-B — dry-run de una fila: qué haría `procesar` con ella, sin escribir. Lo reusa la
  // bandeja de staging (ImportacionContableLoteService) para mostrarle al revisor el efecto de
  // aprobar un lote antes de tocar la Base Patrimonial.
  async evaluarFila(
    organizacionId: string,
    fila: FilaImportacionContable,
  ): Promise<'crear' | 'ya_importado' | 'conflicto'> {
    const existente = await this.activoRepository.findByCodigoPatrimonial(
      fila.codigoPatrimonial,
    );
    if (!existente) return 'crear';
    // Reintentar la misma fila con el mismo contenido no duplica; una fila con codigoPatrimonial
    // ya existente pero contenido distinto es conflicto, nunca sobrescribe en silencio (DOC-012 6)
    // — y nunca se elimina (Tomo III 1.4 Entrada 5).
    return this.mismoContenido(existente, fila, organizacionId)
      ? 'ya_importado'
      : 'conflicto';
  }

  private async procesarFila(
    organizacionId: string,
    fila: FilaImportacionContable,
    operadorId: string,
  ): Promise<ResultadoFila> {
    const decision = await this.evaluarFila(organizacionId, fila);
    if (decision === 'crear') {
      return this.crearFila(organizacionId, fila, operadorId);
    }
    if (decision === 'ya_importado') {
      return {
        codigoPatrimonial: fila.codigoPatrimonial,
        resultado: 'ya_importado',
      };
    }
    return {
      codigoPatrimonial: fila.codigoPatrimonial,
      resultado: 'conflicto',
      motivo: `El activo '${fila.codigoPatrimonial}' ya existe con datos distintos — la importacion nunca sobrescribe en silencio (DOC-012 6)`,
    };
  }

  private async crearFila(
    organizacionId: string,
    fila: FilaImportacionContable,
    operadorId: string,
  ): Promise<ResultadoFila> {
    try {
      const activo = await this.activoRepository.crear({
        ...fila,
        organizacionId,
      });
      await this.eventoRepository.registrar({
        activoId: activo.id,
        tipo: 'alta',
        usuario: operadorId,
        detalle: {
          codigoPatrimonial: fila.codigoPatrimonial,
          origen: 'importacion_contable',
        },
      });
      return { codigoPatrimonial: fila.codigoPatrimonial, resultado: 'creado' };
    } catch (error: unknown) {
      return {
        codigoPatrimonial: fila.codigoPatrimonial,
        resultado: 'conflicto',
        motivo: error instanceof Error ? error.message : 'error desconocido',
      };
    }
  }

  // Campos disponibles en el Activo que ya devuelve el repository (codigoQr/area/ubicacion/
  // responsable) — catalogoId/serie/valorPatrimonial no se seleccionan hoy en SELECT_ACTIVO_SQL
  // (ningun consumidor de lectura los necesitaba antes de esta fila).
  private mismoContenido(
    existente: Activo,
    fila: FilaImportacionContable,
    organizacionId: string,
  ): boolean {
    return (
      existente.organizacionId === organizacionId &&
      existente.codigoQr === fila.codigoQr &&
      existente.areaId === (fila.areaId ?? null) &&
      existente.ubicacionId === (fila.ubicacionId ?? null) &&
      existente.responsableId === (fila.responsableId ?? null)
    );
  }
}

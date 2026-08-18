import { Injectable } from '@nestjs/common';
import { CoreClientService } from '../core-client/core-client.service';
import type {
  ActivoCatalogo,
  SesionDetalle,
} from '../core-client/core-client.types';
import {
  AgregacionRepository,
  type CategoriaResumenFila,
} from './agregacion.repository';
import { calcularVeredicto } from './veredicto';

const TOTAL_AREAS = '(todas)';

// Mensaje que consume este servicio — mismo shape que
// core/src/eventos-outbox/eventos-outbox.types.ts (EventosOutboxMensaje), copiado localmente por
// el mismo motivo que core-client.types.ts (sin paquete compartido entre desplegables todavia).
export type MensajeAgregacion =
  | { kind: 'sesion-cerrada'; sesionId: string }
  | {
      kind: 'evento';
      eventoId: string;
      tipo: string;
      organizacionId: string | null;
    };

// DOC-018 §5 — orquesta que recalcular por tipo de mensaje. Deliberadamente sin manejo de
// reintentos/idempotencia propio: BullMQ ya reintenta el job si este metodo tira, y todas las
// escrituras de AgregacionRepository son upserts o DELETE+INSERT completos (DOC-018 §5.3).
@Injectable()
export class AgregacionService {
  constructor(
    private readonly coreClient: CoreClientService,
    private readonly repository: AgregacionRepository,
  ) {}

  async procesarMensaje(mensaje: MensajeAgregacion): Promise<void> {
    if (mensaje.kind === 'sesion-cerrada') {
      await this.procesarSesionCerrada(mensaje.sesionId);
    } else if (mensaje.organizacionId) {
      await this.procesarEvento(mensaje.organizacionId);
    }
    await this.repository.actualizarSyncEstado();
  }

  // DOC-018 §5.1
  private async procesarSesionCerrada(sesionId: string): Promise<void> {
    const sesion = await this.coreClient.obtenerInventarioDetalle(sesionId);
    const catalogo = await this.coreClient.obtenerCatalogoCompleto(
      sesion.organizacionId,
    );
    const catalogoPorCodigo = new Map(catalogo.map((a) => [a.codigoQr, a]));

    const correctos = sesion.escaneos.filter((e) => e.resultado === 'correcto');
    const fueraDeArea = sesion.escaneos.filter(
      (e) => e.resultado === 'otra_area' || e.resultado === 'otra_ubicacion',
    );
    const conIncidencia = sesion.escaneos.filter(
      (e) => e.resultado === 'con_incidencia',
    );

    const veredicto = calcularVeredicto(
      this.contarFaltantes(sesion, catalogo, correctos),
      fueraDeArea.length,
    );
    await this.repository.upsertVeredictoSesion({
      sesionId: sesion.id,
      organizacionId: sesion.organizacionId,
      areaId: sesion.areaId,
      veredicto,
      fechaCierre: sesion.fechaCierre,
    });
    await this.repository.upsertControlArea(
      sesion.areaId,
      sesion.organizacionId,
      sesion.fechaCierre,
    );

    const codigosEscaneados = [...correctos, ...fueraDeArea].map(
      (e) => e.codigoQr,
    );
    await this.repository.marcarEscaneadosAlgunaVez(
      sesion.organizacionId,
      codigosEscaneados,
    );
    await this.repository.recalcularCobertura(
      sesion.organizacionId,
      catalogo.length,
    );

    for (const escaneo of fueraDeArea) {
      const activo = catalogoPorCodigo.get(escaneo.codigoQr);
      if (!activo) {
        continue;
      }
      await this.repository.upsertFueraDeArea({
        codigoQr: escaneo.codigoQr,
        organizacionId: sesion.organizacionId,
        areaRealId: sesion.areaId,
        areaEsperadaId: activo.areaId,
      });
    }

    for (const escaneo of conIncidencia) {
      await this.repository.upsertIncidencia({
        sesionId: sesion.id,
        codigoQr: escaneo.codigoQr,
        organizacionId: sesion.organizacionId,
        observaciones: escaneo.observaciones ?? '',
        fecha: sesion.fechaCierre,
      });
    }
  }

  // Activos del catalogo esperados en el area de la sesion que no fueron escaneados 'correcto'.
  private contarFaltantes(
    sesion: SesionDetalle,
    catalogo: readonly ActivoCatalogo[],
    correctos: readonly { codigoQr: string }[],
  ): number {
    const codigosCorrectos = new Set(correctos.map((e) => e.codigoQr));
    return catalogo.filter(
      (a) => a.areaId === sesion.areaId && !codigosCorrectos.has(a.codigoQr),
    ).length;
  }

  // DOC-018 §5.2
  private async procesarEvento(organizacionId: string): Promise<void> {
    const catalogo =
      await this.coreClient.obtenerCatalogoCompleto(organizacionId);

    const porEstado = new Map<string, number>();
    for (const activo of catalogo) {
      porEstado.set(activo.estado, (porEstado.get(activo.estado) ?? 0) + 1);
    }
    await this.repository.reemplazarEstadoActivoResumen(
      organizacionId,
      [...porEstado.entries()].map(([estado, cantidad]) => ({
        estado,
        cantidad,
      })),
    );

    await this.repository.reemplazarCategoriaActivoResumen(
      organizacionId,
      this.agruparPorCategoria(catalogo),
    );

    await this.repository.recalcularCobertura(organizacionId, catalogo.length);

    const extraviados = catalogo
      .filter((a) => a.estado === 'extraviado')
      .map((a) => a.codigoQr);
    await this.repository.reemplazarActivoNoLocalizado(
      organizacionId,
      extraviados,
    );
  }

  // Mapa anidado, no una clave compuesta por concatenacion de strings — areaId/familia pueden
  // traer espacios (ej. "Equipos Varios"), una clave tipo `${a} ${b}` seria ambigua al
  // reconstruirla con split().
  private agruparPorCategoria(
    catalogo: readonly ActivoCatalogo[],
  ): CategoriaResumenFila[] {
    const porArea = new Map<string, Map<string, number>>();
    const porFamiliaTotal = new Map<string, number>();

    for (const activo of catalogo) {
      const porFamiliaDelArea =
        porArea.get(activo.areaId) ?? new Map<string, number>();
      porFamiliaDelArea.set(
        activo.familia,
        (porFamiliaDelArea.get(activo.familia) ?? 0) + 1,
      );
      porArea.set(activo.areaId, porFamiliaDelArea);

      porFamiliaTotal.set(
        activo.familia,
        (porFamiliaTotal.get(activo.familia) ?? 0) + 1,
      );
    }

    const filas: CategoriaResumenFila[] = [];
    for (const [areaId, porFamilia] of porArea) {
      for (const [familia, cantidad] of porFamilia) {
        filas.push({ areaId, familia, cantidad });
      }
    }
    for (const [familia, cantidad] of porFamiliaTotal) {
      filas.push({ areaId: TOTAL_AREAS, familia, cantidad });
    }
    return filas;
  }
}

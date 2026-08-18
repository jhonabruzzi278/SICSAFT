import { Injectable } from '@nestjs/common';
import { CipClientService } from '../cip-client/cip-client.service';
import type {
  AreasResult,
  CategoriasResult,
  CoberturaResult,
  EstadoActivosResult,
  FueraDeAreaResult,
  IncidenciasResult,
  NoLocalizadosResult,
  SesionesResult,
} from '../cip-client/cip-client.types';

// DOC-019 §3.1 — proxy delgado hacia CIP, mismo criterio que QrConnectorService hacia CORE: sin
// lógica propia, CIP ya resuelve la agregación completa.
@Injectable()
export class DashboardConnectorService {
  constructor(private readonly cipClientService: CipClientService) {}

  getCobertura(
    organizacionId: string,
    correlationId: string,
  ): Promise<CoberturaResult> {
    return this.cipClientService.getCobertura(organizacionId, correlationId);
  }

  getAreas(
    organizacionId: string,
    correlationId: string,
  ): Promise<AreasResult> {
    return this.cipClientService.getAreas(organizacionId, correlationId);
  }

  getSesiones(
    organizacionId: string,
    areaId: string | undefined,
    limit: number,
    offset: number,
    correlationId: string,
  ): Promise<SesionesResult> {
    return this.cipClientService.getSesiones(
      organizacionId,
      areaId,
      { limit, offset },
      correlationId,
    );
  }

  getFueraDeArea(
    organizacionId: string,
    areaId: string | undefined,
    limit: number,
    offset: number,
    correlationId: string,
  ): Promise<FueraDeAreaResult> {
    return this.cipClientService.getFueraDeArea(
      organizacionId,
      areaId,
      { limit, offset },
      correlationId,
    );
  }

  getNoLocalizados(
    organizacionId: string,
    limit: number,
    offset: number,
    correlationId: string,
  ): Promise<NoLocalizadosResult> {
    return this.cipClientService.getNoLocalizados(
      organizacionId,
      { limit, offset },
      correlationId,
    );
  }

  getIncidencias(
    organizacionId: string,
    codigoQr: string | undefined,
    limit: number,
    offset: number,
    correlationId: string,
  ): Promise<IncidenciasResult> {
    return this.cipClientService.getIncidencias(
      organizacionId,
      codigoQr,
      { limit, offset },
      correlationId,
    );
  }

  getEstadoActivos(
    organizacionId: string,
    correlationId: string,
  ): Promise<EstadoActivosResult> {
    return this.cipClientService.getEstadoActivos(
      organizacionId,
      correlationId,
    );
  }

  getCategorias(
    organizacionId: string,
    areaId: string | undefined,
    correlationId: string,
  ): Promise<CategoriasResult> {
    return this.cipClientService.getCategorias(
      organizacionId,
      areaId,
      correlationId,
    );
  }
}

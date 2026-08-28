import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { KeycloakAuthGuard } from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { DashboardConnectorService } from './dashboard-connector.service';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import {
  areasQuerySchema,
  categoriasQuerySchema,
  coberturaQuerySchema,
  estadoActivosQuerySchema,
  fueraDeAreaQuerySchema,
  incidenciasQuerySchema,
  noLocalizadosQuerySchema,
  sesionesQuerySchema,
  type AreasQuery,
  type CategoriasQuery,
  type CoberturaQuery,
  type EstadoActivosQuery,
  type FueraDeAreaQuery,
  type IncidenciasQuery,
  type NoLocalizadosQuery,
  type SesionesQuery,
} from './dashboard-connector.schemas';
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

// DOC-019 2/3.1 — septimo módulo del hub de WEB (RF-09): mismo criterio de autorización que
// Activos/Inventarios (KeycloakAuthGuard + RateLimitGuard, sin rol adicional) porque es información
// agregada de organización completa, no PII ni una escritura — no el patrón de
// AdministradorController (/admin/..., reservado para escritura oficial). Pipes por parámetro, no
// @UsePipes de método (DOC-012 5 ya dejó ese hallazgo real).
@Controller('dashboard')
@UseGuards(KeycloakAuthGuard, RateLimitGuard)
export class DashboardConnectorController {
  constructor(
    private readonly dashboardConnectorService: DashboardConnectorService,
  ) {}

  @Get('cobertura')
  getCobertura(
    @Query(new ZodValidationPipe(coberturaQuerySchema)) query: CoberturaQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<CoberturaResult> {
    return this.dashboardConnectorService.getCobertura(
      query.organizacionId,
      request.correlationId,
    );
  }

  @Get('areas')
  getAreas(
    @Query(new ZodValidationPipe(areasQuerySchema)) query: AreasQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<AreasResult> {
    return this.dashboardConnectorService.getAreas(
      query.organizacionId,
      request.correlationId,
    );
  }

  @Get('sesiones')
  getSesiones(
    @Query(new ZodValidationPipe(sesionesQuerySchema)) query: SesionesQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<SesionesResult> {
    return this.dashboardConnectorService.getSesiones(
      query.organizacionId,
      query.areaId,
      query.limit,
      query.offset,
      request.correlationId,
    );
  }

  @Get('fuera-de-area')
  getFueraDeArea(
    @Query(new ZodValidationPipe(fueraDeAreaQuerySchema))
    query: FueraDeAreaQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<FueraDeAreaResult> {
    return this.dashboardConnectorService.getFueraDeArea(
      query.organizacionId,
      query.areaId,
      query.limit,
      query.offset,
      request.correlationId,
    );
  }

  @Get('no-localizados')
  getNoLocalizados(
    @Query(new ZodValidationPipe(noLocalizadosQuerySchema))
    query: NoLocalizadosQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<NoLocalizadosResult> {
    return this.dashboardConnectorService.getNoLocalizados(
      query.organizacionId,
      query.limit,
      query.offset,
      request.correlationId,
    );
  }

  @Get('incidencias')
  getIncidencias(
    @Query(new ZodValidationPipe(incidenciasQuerySchema))
    query: IncidenciasQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<IncidenciasResult> {
    return this.dashboardConnectorService.getIncidencias(
      query.organizacionId,
      query.codigoQr,
      query.limit,
      query.offset,
      request.correlationId,
    );
  }

  @Get('estado-activos')
  getEstadoActivos(
    @Query(new ZodValidationPipe(estadoActivosQuerySchema))
    query: EstadoActivosQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<EstadoActivosResult> {
    return this.dashboardConnectorService.getEstadoActivos(
      query.organizacionId,
      request.correlationId,
    );
  }

  @Get('categorias')
  getCategorias(
    @Query(new ZodValidationPipe(categoriasQuerySchema))
    query: CategoriasQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<CategoriasResult> {
    return this.dashboardConnectorService.getCategorias(
      query.organizacionId,
      query.areaId,
      request.correlationId,
    );
  }
}

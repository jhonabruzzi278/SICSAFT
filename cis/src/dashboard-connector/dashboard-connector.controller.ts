import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  KeycloakAuthGuard,
  requireAuthContext,
} from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import {
  DirectivoGuard,
  type DirectivoRequest,
} from '../directivo/directivo.guard';
import { DashboardConnectorService } from './dashboard-connector.service';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import {
  areasQuerySchema,
  categoriasQuerySchema,
  coberturaQuerySchema,
  estadoActivosQuerySchema,
  fueraDeAreaQuerySchema,
  historicoQuerySchema,
  incidenciasQuerySchema,
  noLocalizadosQuerySchema,
  sesionesQuerySchema,
  veredictosQuerySchema,
  type AreasQuery,
  type CategoriasQuery,
  type CoberturaQuery,
  type EstadoActivosQuery,
  type FueraDeAreaQuery,
  type HistoricoQuery,
  type IncidenciasQuery,
  type NoLocalizadosQuery,
  type SesionesQuery,
  type VeredictosQuery,
} from './dashboard-connector.schemas';
import type {
  AreasResult,
  CategoriasResult,
  CoberturaResult,
  EstadoActivosResult,
  FueraDeAreaResult,
  HistoricoResult,
  IncidenciasResult,
  NoLocalizadosResult,
  RevisarSesionResult,
  SesionesResult,
  VeredictosResult,
} from '../cip-client/cip-client.types';

// DOC-019 2/3.1 — septimo módulo del hub de WEB (RF-09): mismo criterio de autorización que
// Activos/Inventarios (KeycloakAuthGuard + RateLimitGuard, sin rol adicional) porque es información
// agregada de organización completa, no PII ni una escritura — no el patrón de
// los controllers de /admin/... (reservado para escritura oficial). Pipes por parámetro, no
// @UsePipes de método (DOC-012 5 ya dejó ese hallazgo real). Única excepción: `revisarSesion`
// (2026-09-16) sí escribe, así que suma `DirectivoGuard` en esa ruta puntual.
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

  // Notificaciones del organigrama (2026-09-16) — única escritura de este controller (el resto es
  // agregado de lectura, ver comentario de clase). `DirectivoGuard` solo en esta ruta: el resto
  // del controller queda con el criterio original (KeycloakAuthGuard, sin rol) porque son
  // lecturas de agregados, no PII; esto sí muta estado, así que exige el rol `directivo`.
  // `revisadoPor` se deriva del propio JWT (`requireAuthContext`) — nunca lo manda el cliente.
  @Patch('sesiones/:sesionId/revisar')
  @UseGuards(DirectivoGuard)
  revisarSesion(
    @Param('sesionId') sesionId: string,
    @Req() request: DirectivoRequest & RequestWithCorrelationId,
  ): Promise<RevisarSesionResult> {
    return this.dashboardConnectorService.revisarSesion(
      sesionId,
      requireAuthContext(request).operadorId,
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

  @Get('veredictos')
  getVeredictos(
    @Query(new ZodValidationPipe(veredictosQuerySchema)) query: VeredictosQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<VeredictosResult> {
    return this.dashboardConnectorService.getVeredictos(
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

  // DOC-034 Parte B
  @Get('historico')
  getHistorico(
    @Query(new ZodValidationPipe(historicoQuerySchema)) query: HistoricoQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<HistoricoResult> {
    return this.dashboardConnectorService.getHistorico(
      query.organizacionId,
      query.desde,
      query.hasta,
      query.limit,
      query.offset,
      request.correlationId,
    );
  }
}

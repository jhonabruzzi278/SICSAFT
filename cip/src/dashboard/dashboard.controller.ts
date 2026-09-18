import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DashboardRepository } from './dashboard.repository';
import {
  areasQuerySchema,
  categoriasQuerySchema,
  coberturaQuerySchema,
  estadoActivosQuerySchema,
  fueraDeAreaQuerySchema,
  historicoQuerySchema,
  incidenciasQuerySchema,
  noLocalizadosQuerySchema,
  revisarSesionSchema,
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
  type RevisarSesionBody,
  type SesionesQuery,
  type VeredictosQuery,
} from './dashboard.schemas';
import type {
  CategoriaResumenResponse,
  CoberturaResponse,
  ControlAreaResponse,
  EstadoResumenResponse,
  FueraDeAreaResponse,
  IncidenciaResponse,
  NoLocalizadoResponse,
  Pagina,
  ResumenDiarioResponse,
  ResumenVeredictosResponse,
  SyncInfo,
  VeredictoSesionResponse,
} from './dashboard.types';

// DOC-018 6 — RF-01 a RF-09. Todos exigen ServiceTokenGuard (CIP_SERVICE_TOKEN, decisión
// provisional hasta que exista un frontend con su propio modelo de auth, DOC-014 7.1) y
// devuelven la info de sync (actualizadoEn/alDia) en el body — RF-10.
@Controller('dashboard')
@UseGuards(ServiceTokenGuard)
export class DashboardController {
  constructor(private readonly repository: DashboardRepository) {}

  @Get('cobertura')
  async getCobertura(
    @Query(new ZodValidationPipe(coberturaQuerySchema)) query: CoberturaQuery,
  ): Promise<CoberturaResponse> {
    const [cobertura, sync] = await Promise.all([
      this.repository.obtenerCobertura(query.organizacionId),
      this.repository.obtenerSyncInfo(),
    ]);
    return {
      activosRegistrados: cobertura?.activosRegistrados ?? 0,
      activosEscaneados: cobertura?.activosEscaneados ?? 0,
      porcentajeCobertura: cobertura?.porcentajeCobertura ?? 0,
      ...sync,
    };
  }

  @Get('areas')
  async getAreas(
    @Query(new ZodValidationPipe(areasQuerySchema)) query: AreasQuery,
  ): Promise<{ areas: ControlAreaResponse[] } & SyncInfo> {
    const [areas, sync] = await Promise.all([
      this.repository.listarAreas(query.organizacionId),
      this.repository.obtenerSyncInfo(),
    ]);
    return { areas, ...sync };
  }

  @Get('sesiones')
  async getSesiones(
    @Query(new ZodValidationPipe(sesionesQuerySchema)) query: SesionesQuery,
  ): Promise<Pagina<VeredictoSesionResponse> & SyncInfo> {
    const [pagina, sync] = await Promise.all([
      this.repository.listarSesiones(
        query.organizacionId,
        query.areaId,
        query.limit,
        query.offset,
      ),
      this.repository.obtenerSyncInfo(),
    ]);
    return { ...pagina, ...sync };
  }

  // Notificaciones del organigrama (2026-09-16) — acción final desde Pantalla 8, sin
  // "des-revisar". 404 si la sesión no existe en `veredicto_sesion` (aún no llegó el evento
  // `sesion-cerrada` desde CORE, o el sesionId es incorrecto).
  @Patch('sesiones/:sesionId/revisar')
  async revisarSesion(
    @Param('sesionId') sesionId: string,
    @Body(new ZodValidationPipe(revisarSesionSchema)) body: RevisarSesionBody,
  ): Promise<VeredictoSesionResponse> {
    const actualizada = await this.repository.marcarSesionRevisada(
      sesionId,
      body.revisadoPor,
    );
    if (!actualizada) {
      throw new NotFoundException(
        `No existe la sesión ${sesionId} en veredicto_sesion`,
      );
    }
    return actualizada;
  }

  @Get('fuera-de-area')
  async getFueraDeArea(
    @Query(new ZodValidationPipe(fueraDeAreaQuerySchema))
    query: FueraDeAreaQuery,
  ): Promise<Pagina<FueraDeAreaResponse> & SyncInfo> {
    const [pagina, sync] = await Promise.all([
      this.repository.listarFueraDeArea(
        query.organizacionId,
        query.areaId,
        query.limit,
        query.offset,
      ),
      this.repository.obtenerSyncInfo(),
    ]);
    return { ...pagina, ...sync };
  }

  @Get('no-localizados')
  async getNoLocalizados(
    @Query(new ZodValidationPipe(noLocalizadosQuerySchema))
    query: NoLocalizadosQuery,
  ): Promise<Pagina<NoLocalizadoResponse> & SyncInfo> {
    const [pagina, sync] = await Promise.all([
      this.repository.listarNoLocalizados(
        query.organizacionId,
        query.limit,
        query.offset,
      ),
      this.repository.obtenerSyncInfo(),
    ]);
    return { ...pagina, ...sync };
  }

  @Get('incidencias')
  async getIncidencias(
    @Query(new ZodValidationPipe(incidenciasQuerySchema))
    query: IncidenciasQuery,
  ): Promise<Pagina<IncidenciaResponse> & SyncInfo> {
    const [pagina, sync] = await Promise.all([
      this.repository.listarIncidencias(
        query.organizacionId,
        query.codigoQr,
        query.limit,
        query.offset,
      ),
      this.repository.obtenerSyncInfo(),
    ]);
    return { ...pagina, ...sync };
  }

  @Get('estado-activos')
  async getEstadoActivos(
    @Query(new ZodValidationPipe(estadoActivosQuerySchema))
    query: EstadoActivosQuery,
  ): Promise<{ estados: EstadoResumenResponse[] } & SyncInfo> {
    const [estados, sync] = await Promise.all([
      this.repository.listarEstadoActivos(query.organizacionId),
      this.repository.obtenerSyncInfo(),
    ]);
    return { estados, ...sync };
  }

  @Get('veredictos')
  async getVeredictos(
    @Query(new ZodValidationPipe(veredictosQuerySchema)) query: VeredictosQuery,
  ): Promise<ResumenVeredictosResponse & SyncInfo> {
    const [resumen, sync] = await Promise.all([
      this.repository.resumenVeredictos(query.organizacionId),
      this.repository.obtenerSyncInfo(),
    ]);
    return { ...resumen, ...sync };
  }

  @Get('historico')
  async getHistorico(
    @Query(new ZodValidationPipe(historicoQuerySchema)) query: HistoricoQuery,
  ): Promise<Pagina<ResumenDiarioResponse> & SyncInfo> {
    const [pagina, sync] = await Promise.all([
      this.repository.listarHistorico(
        query.organizacionId,
        query.desde,
        query.hasta,
        query.limit,
        query.offset,
      ),
      this.repository.obtenerSyncInfo(),
    ]);
    return { ...pagina, ...sync };
  }

  @Get('categorias')
  async getCategorias(
    @Query(new ZodValidationPipe(categoriasQuerySchema))
    query: CategoriasQuery,
  ): Promise<{ categorias: CategoriaResumenResponse[] } & SyncInfo> {
    const [categorias, sync] = await Promise.all([
      this.repository.listarCategorias(query.organizacionId, query.areaId),
      this.repository.obtenerSyncInfo(),
    ]);
    return { categorias, ...sync };
  }
}

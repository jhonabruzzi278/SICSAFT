import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, type AxiosResponse } from 'axios';
import type { ZodType } from 'zod';
import {
  CORE_CIRCUIT_BREAKER,
  CORE_CLIENT_CONFIG,
} from './core-client.constants';
import type { CoreClientConfig } from './core-client.config';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { withRetry } from './retry';
import {
  activoResponseSchema,
  areaResponseSchema,
  areasPaginaResponseSchema,
  auditoriaPaginaResponseSchema,
  catalogoResponseSchema,
  catalogoTipoResponseSchema,
  catalogoTiposResponseSchema,
  documentoActivoResponseSchema,
  documentosActivoResponseSchema,
  entitlementsResponseSchema,
  importacionContableResponseSchema,
  crearLoteImportacionContableResponseSchema,
  lotesImportacionContableResponseSchema,
  loteConFilasImportacionContableResponseSchema,
  rechazoLoteImportacionContableResponseSchema,
  inventarioEstadoResponseSchema,
  postInventarioResponseSchema,
  responsableResponseSchema,
  responsablesPaginaResponseSchema,
  resumenControlResponseSchema,
  sesionDetalleResponseSchema,
  sesionesResumenResponseSchema,
  ubicacionResponseSchema,
  ubicacionesPaginaResponseSchema,
  type ActivoResult,
  type AreaResult,
  type AreasPaginaResult,
  type AuditoriaFiltro,
  type AuditoriaPaginaResult,
  type CatalogoResult,
  type CatalogoTipoResult,
  type DocumentoActivoResult,
  type EntitlementsResult,
  type EscrituraOficialRequest,
  type ImportacionContableResult,
  type InventarioEstadoResult,
  type Paginacion,
  type PatchActivoDescripcionRequest,
  type PatchActivoResponsableRequest,
  type PatchAreaRequest,
  type PatchResponsableEstadoRequest,
  type PatchUbicacionRequest,
  type PostActivoRequest,
  type PostAreaRequest,
  type PostAuditoriaRequest,
  type PostCatalogoTipoRequest,
  type PostDocumentoActivoRequest,
  type PostImportacionContableRequest,
  type PostLoteImportacionContableRequest,
  type AprobarLoteImportacionContableRequest,
  type RechazarLoteImportacionContableRequest,
  type CrearLoteImportacionContableResult,
  type LoteImportacionContableResult,
  type LoteConFilasImportacionContableResult,
  type RechazoLoteImportacionContableResult,
  type PostInventarioResult,
  type PostResponsableRequest,
  type PostUbicacionRequest,
  type ResponsableResult,
  type ResponsablesPaginaResult,
  type ResumenControlResult,
  type SesionDetalleResult,
  type SesionResumenResult,
  type UbicacionResult,
  type UbicacionesPaginaResult,
} from './core-client.types';
import { CORRELATION_ID_HEADER } from '../common/correlation-id/correlation-id.constants';
import type {
  CatalogoQuery,
  InventarioRequest,
} from '../qr-connector/qr-connector.schemas';

// Debe coincidir exactamente con core/src/common/auth/service-token.guard.ts — no hay paquete
// compartido entre CIS y CORE todavia (mismo caso que Organizacion/Sede en core-client.types.ts).
const SERVICE_TOKEN_HEADER = 'x-internal-service-token';

// WAF 4: parametros conservadores para el trafico actual, igual criterio que
// CORE_CIRCUIT_BREAKER en core-client.module.ts. 3 intentos totales, 200ms/400ms de backoff.
const CORE_RETRY_MAX_ATTEMPTS = 3;
const CORE_RETRY_BASE_DELAY_MS = 200;

// Solo reintenta lo transitorio: sin respuesta (red caida/timeout) o 5xx. Un 400/404/409 es un
// rechazo permanente del lado de CORE (DOC-002 5) — reintentarlo no cambia el resultado.
function isTransientCoreError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }
  return error.response === undefined || error.response.status >= 500;
}

@Injectable()
export class CoreClientService {
  constructor(
    @Inject(CORE_CLIENT_CONFIG) private readonly config: CoreClientConfig,
    @Inject(CORE_CIRCUIT_BREAKER) private readonly breaker: CircuitBreaker,
    private readonly httpService: HttpService,
  ) {}

  async getEntitlements(
    operadorId: string,
    correlationId: string,
  ): Promise<EntitlementsResult> {
    const data = await this.get('/entitlements', { operadorId }, correlationId);
    return this.parse(entitlementsResponseSchema, data, 'entitlements');
  }

  // DOC-006 2 — reemplaza SEED_CATALOGO (ROADMAP.md Fase 3).
  async getCatalogo(
    query: CatalogoQuery,
    correlationId: string,
  ): Promise<CatalogoResult> {
    const data = await this.get('/catalogo', query, correlationId);
    return this.parse(catalogoResponseSchema, data, 'catalogo');
  }

  // DOC-006 3 — reemplaza los Map en memoria de QrConnectorService. A diferencia de
  // getEntitlements/getCatalogo, acá SI se propaga el error de CORE (400/409) tal cual en vez de
  // colapsarlo a 502 — DOC-002 5 exige que el cliente pueda distinguir "rechazado, no
  // reintentar" (400/409) de "transitorio, reintentar" (5xx/timeout/circuito abierto).
  async postInventario(
    request: InventarioRequest,
    correlationId: string,
  ): Promise<PostInventarioResult> {
    const data = await this.post('/inventarios', request, correlationId);
    return this.parse(postInventarioResponseSchema, data, 'inventarios');
  }

  // DOC-012 5 — proxy hacia POST /activos de CORE (escritura oficial). A diferencia de
  // postInventario, acá se propaga tambien un 403 (falta el rol administrador-patrimonial en esa
  // organizacion) ademas de 400/409 — DOC-012 8 exige que el 403 llegue tal cual, no colapsado a
  // 502, para que WEB pueda distinguir "sin permiso" de "CORE caido".
  async postActivo(
    request: PostActivoRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    const data = await this.post('/activos', request, correlationId, {
      passthroughStatuses: [400, 403, 409],
    });
    return this.parse(activoResponseSchema, data, 'activos');
  }

  // DOC-021 3 (gap "estados") — proxy hacia POST /activos/:id/baja y /reincorporacion de CORE.
  async postActivoBaja(
    activoId: string,
    request: EscrituraOficialRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    const data = await this.post(
      `/activos/${encodeURIComponent(activoId)}/baja`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 404, 409] },
    );
    return this.parse(activoResponseSchema, data, 'activos');
  }

  async postActivoReincorporacion(
    activoId: string,
    request: EscrituraOficialRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    const data = await this.post(
      `/activos/${encodeURIComponent(activoId)}/reincorporacion`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 404, 409] },
    );
    return this.parse(activoResponseSchema, data, 'activos');
  }

  async patchActivoResponsable(
    activoId: string,
    request: PatchActivoResponsableRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    const data = await this.patch(
      `/activos/${encodeURIComponent(activoId)}/responsable`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 404, 409] },
    );
    return this.parse(activoResponseSchema, data, 'activos');
  }

  // DOC-021 3 (gap "descripciones").
  async patchActivoDescripcion(
    activoId: string,
    request: PatchActivoDescripcionRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    const data = await this.patch(
      `/activos/${encodeURIComponent(activoId)}/descripcion`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 404, 409] },
    );
    return this.parse(activoResponseSchema, data, 'activos');
  }

  // DOC-021 4 (gap "familias/categorías") — lectura abierta, mismo criterio que getCatalogo.
  async getCatalogoTipos(correlationId: string): Promise<CatalogoTipoResult[]> {
    const data = await this.get('/catalogo-tipos', undefined, correlationId);
    return this.parse(catalogoTiposResponseSchema, data, 'catalogo-tipos');
  }

  async postCatalogoTipo(
    request: PostCatalogoTipoRequest,
    correlationId: string,
  ): Promise<CatalogoTipoResult> {
    const data = await this.post('/catalogo-tipos', request, correlationId, {
      passthroughStatuses: [400, 403, 409],
    });
    return this.parse(catalogoTipoResponseSchema, data, 'catalogo-tipos');
  }

  // DOC-021 3 (gap "documentación y fotografías").
  async getDocumentosActivo(
    activoId: string,
    organizacionId: string,
    correlationId: string,
  ): Promise<DocumentoActivoResult[]> {
    const data = await this.get(
      `/activos/${encodeURIComponent(activoId)}/documentos`,
      { organizacionId },
      correlationId,
    );
    return this.parse(documentosActivoResponseSchema, data, 'documentos');
  }

  async postDocumentoActivo(
    activoId: string,
    request: PostDocumentoActivoRequest,
    correlationId: string,
  ): Promise<DocumentoActivoResult> {
    const data = await this.post(
      `/activos/${encodeURIComponent(activoId)}/documentos`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 404, 409] },
    );
    return this.parse(documentoActivoResponseSchema, data, 'documentos');
  }

  async deleteDocumentoActivo(
    activoId: string,
    documentoId: string,
    request: EscrituraOficialRequest,
    correlationId: string,
  ): Promise<void> {
    await this.delete(
      `/activos/${encodeURIComponent(activoId)}/documentos/${encodeURIComponent(documentoId)}`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 404] },
    );
  }
  // DOC-012 6 (gap "importaciones controladas") — proxy hacia POST /importaciones/contable de
  // CORE, idempotente por fila (nunca 409 a nivel de request completo, ver
  // ImportacionContableService).
  async postImportacionContable(
    request: PostImportacionContableRequest,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    const data = await this.post(
      '/importaciones/contable',
      request,
      correlationId,
      { passthroughStatuses: [400, 403] },
    );
    return this.parse(
      importacionContableResponseSchema,
      data,
      'importaciones/contable',
    );
  }

  // DOC-029 RF-B — bandeja de staging. crear/aprobar/rechazar son escrituras oficiales (CORE
  // verifica el rol desde rolesPorOrganizacion y audita); listar/obtener son lecturas.
  async postLoteImportacionContable(
    request: PostLoteImportacionContableRequest,
    correlationId: string,
  ): Promise<CrearLoteImportacionContableResult> {
    const data = await this.post(
      '/importaciones/contable/lote',
      request,
      correlationId,
      { passthroughStatuses: [400, 403] },
    );
    return this.parse(
      crearLoteImportacionContableResponseSchema,
      data,
      'importaciones/contable/lote',
    );
  }

  async getLotesImportacionContable(
    organizacionId: string,
    estado: string | undefined,
    correlationId: string,
  ): Promise<LoteImportacionContableResult[]> {
    const data = await this.get(
      '/importaciones/contable/lote',
      { organizacionId, estado },
      correlationId,
    );
    return this.parse(
      lotesImportacionContableResponseSchema,
      data,
      'importaciones/contable/lote',
    );
  }

  async getLoteImportacionContable(
    loteId: string,
    correlationId: string,
  ): Promise<LoteConFilasImportacionContableResult> {
    const data = await this.get(
      `/importaciones/contable/lote/${encodeURIComponent(loteId)}`,
      undefined,
      correlationId,
    );
    return this.parse(
      loteConFilasImportacionContableResponseSchema,
      data,
      'importaciones/contable/lote/:id',
    );
  }

  async postAprobarLoteImportacionContable(
    loteId: string,
    request: AprobarLoteImportacionContableRequest,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    const data = await this.post(
      `/importaciones/contable/lote/${encodeURIComponent(loteId)}/aprobar`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 404, 409] },
    );
    return this.parse(
      importacionContableResponseSchema,
      data,
      'importaciones/contable/lote/:id/aprobar',
    );
  }

  async postRechazarLoteImportacionContable(
    loteId: string,
    request: RechazarLoteImportacionContableRequest,
    correlationId: string,
  ): Promise<RechazoLoteImportacionContableResult> {
    const data = await this.post(
      `/importaciones/contable/lote/${encodeURIComponent(loteId)}/rechazar`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 404, 409] },
    );
    return this.parse(
      rechazoLoteImportacionContableResponseSchema,
      data,
      'importaciones/contable/lote/:id/rechazar',
    );
  }
  async getInventarioEstado(
    inventarioId: string,
    correlationId: string,
  ): Promise<InventarioEstadoResult> {
    const data = await this.get(
      `/inventarios/${encodeURIComponent(inventarioId)}/estado`,
      undefined,
      correlationId,
    );
    return this.parse(
      inventarioEstadoResponseSchema,
      data,
      'inventarios/estado',
    );
  }

  // RF-04 (Fase 5, WEB) — lectura abierta, mismo criterio que getCatalogo/getContratos.
  async getInventarios(
    organizacionId: string,
    correlationId: string,
  ): Promise<SesionResumenResult[]> {
    const data = await this.get(
      '/inventarios',
      { organizacionId },
      correlationId,
    );
    return this.parse(sesionesResumenResponseSchema, data, 'inventarios');
  }

  async getInventarioDetalle(
    inventarioId: string,
    correlationId: string,
  ): Promise<SesionDetalleResult> {
    const data = await this.get(
      `/inventarios/${encodeURIComponent(inventarioId)}`,
      undefined,
      correlationId,
    );
    return this.parse(sesionDetalleResponseSchema, data, 'inventarios/detalle');
  }

  // DOC-029 RF-I — informe de control de área de una sesión ("Pantalla 8"). Lectura abierta,
  // mismo criterio que getInventarioDetalle.
  async getInventarioResumenControl(
    inventarioId: string,
    correlationId: string,
  ): Promise<ResumenControlResult> {
    const data = await this.get(
      `/inventarios/${encodeURIComponent(inventarioId)}/control`,
      undefined,
      correlationId,
    );
    return this.parse(
      resumenControlResponseSchema,
      data,
      'inventarios/control',
    );
  }

  // RF-06 (Fase 5, WEB) — lectura abierta, mismo criterio que getCatalogo/getContratos. Paginado
  // (RNF-01, cierra el gap).
  async getAuditoria(
    filtro: AuditoriaFiltro,
    correlationId: string,
  ): Promise<AuditoriaPaginaResult> {
    const data = await this.get(
      '/auditoria',
      {
        usuario: filtro.usuario,
        operacion: filtro.operacion,
        fechaDesde: filtro.fechaDesde,
        fechaHasta: filtro.fechaHasta,
        area: filtro.area,
        limit: filtro.limit,
        offset: filtro.offset,
      },
      correlationId,
    );
    return this.parse(auditoriaPaginaResponseSchema, data, 'auditoria');
  }

  // DOC-024 3 — POST /auditoria. Reporta a CORE el resultado de una operacion de identidad en
  // Zitadel que nunca pasa por el Orquestador (asignar/quitar rol, crear organizacion en
  // Zitadel) — ver cis/src/auditoria-identidad/auditoria-identidad.service.ts. Sin
  // passthroughStatuses: si esto falla, no hay un rechazo de negocio que distinguir, es
  // simplemente "no se pudo auditar" — 502 genérico alcanza (ver AuditoriaIdentidadService, que
  // no atrapa este fallo a propósito, DOC-024 3).
  async postAuditoria(
    request: PostAuditoriaRequest,
    correlationId: string,
  ): Promise<void> {
    await this.post('/auditoria', request, correlationId, {
      passthroughStatuses: [],
    });
  }

  // RF-05 (Fase 5, WEB) — lectura abierta, mismo criterio que getCatalogo/getContratos. Paginado
  // (RNF-01, cierra el gap).
  async getAreas(
    organizacionId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<AreasPaginaResult> {
    const data = await this.get(
      '/areas',
      { organizacionId, limit: paginacion.limit, offset: paginacion.offset },
      correlationId,
    );
    return this.parse(areasPaginaResponseSchema, data, 'areas');
  }

  // RF-05 — escritura oficial, mismo criterio de passthroughStatuses que postActivo.
  async postArea(
    request: PostAreaRequest,
    correlationId: string,
  ): Promise<AreaResult> {
    const data = await this.post('/areas', request, correlationId, {
      passthroughStatuses: [400, 403, 409],
    });
    return this.parse(areaResponseSchema, data, 'areas');
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /areas/:id. Sin 404 en passthroughStatuses:
  // callCore ya lo traduce a NotFoundException antes de mirar la lista (mismo criterio que
  // patchContrato/patchResponsableEstado).
  async patchArea(
    areaId: string,
    request: PatchAreaRequest,
    correlationId: string,
  ): Promise<AreaResult> {
    const data = await this.patch(
      `/areas/${encodeURIComponent(areaId)}`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 409] },
    );
    return this.parse(areaResponseSchema, data, 'areas');
  }

  // Paginado (RNF-01, cierra el gap).
  async getUbicaciones(
    sedeId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<UbicacionesPaginaResult> {
    const data = await this.get(
      '/ubicaciones',
      { sedeId, limit: paginacion.limit, offset: paginacion.offset },
      correlationId,
    );
    return this.parse(ubicacionesPaginaResponseSchema, data, 'ubicaciones');
  }

  async postUbicacion(
    request: PostUbicacionRequest,
    correlationId: string,
  ): Promise<UbicacionResult> {
    const data = await this.post('/ubicaciones', request, correlationId, {
      passthroughStatuses: [400, 403, 409],
    });
    return this.parse(ubicacionResponseSchema, data, 'ubicaciones');
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /ubicaciones/:id.
  async patchUbicacion(
    ubicacionId: string,
    request: PatchUbicacionRequest,
    correlationId: string,
  ): Promise<UbicacionResult> {
    const data = await this.patch(
      `/ubicaciones/${encodeURIComponent(ubicacionId)}`,
      request,
      correlationId,
      { passthroughStatuses: [400, 403, 409] },
    );
    return this.parse(ubicacionResponseSchema, data, 'ubicaciones');
  }

  // Paginado (RNF-01, cierra el gap).
  async getResponsables(
    areaId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<ResponsablesPaginaResult> {
    const data = await this.get(
      '/responsables',
      { areaId, limit: paginacion.limit, offset: paginacion.offset },
      correlationId,
    );
    return this.parse(responsablesPaginaResponseSchema, data, 'responsables');
  }

  async postResponsable(
    request: PostResponsableRequest,
    correlationId: string,
  ): Promise<ResponsableResult> {
    const data = await this.post('/responsables', request, correlationId, {
      passthroughStatuses: [400, 403, 409],
    });
    return this.parse(responsableResponseSchema, data, 'responsables');
  }

  async patchResponsableEstado(
    responsableId: string,
    request: PatchResponsableEstadoRequest,
    correlationId: string,
  ): Promise<ResponsableResult> {
    const data = await this.patch(
      `/responsables/${encodeURIComponent(responsableId)}/estado`,
      request,
      correlationId,
      // Sin 404 acá a proposito: callCore ya lo traduce a NotFoundException antes de mirar
      // passthroughStatuses (mismo criterio que patchContrato).
      { passthroughStatuses: [400, 403, 409] },
    );
    return this.parse(responsableResponseSchema, data, 'responsables');
  }

  private async get(
    path: string,
    params: Record<string, string | number | undefined> | undefined,
    correlationId: string,
  ): Promise<unknown> {
    return this.callCore(path, correlationId, () =>
      this.httpService.axiosRef.get(`${this.config.baseUrl}${path}`, {
        params,
        headers: this.headers(correlationId),
      }),
    );
  }

  private async post(
    path: string,
    body: unknown,
    correlationId: string,
    options: { passthroughStatuses: number[] } = {
      passthroughStatuses: [400, 409],
    },
  ): Promise<unknown> {
    return this.callCore(
      path,
      correlationId,
      () =>
        this.httpService.axiosRef.post(`${this.config.baseUrl}${path}`, body, {
          headers: this.headers(correlationId),
        }),
      options,
    );
  }

  private async patch(
    path: string,
    body: unknown,
    correlationId: string,
    options: { passthroughStatuses: number[] },
  ): Promise<unknown> {
    return this.callCore(
      path,
      correlationId,
      () =>
        this.httpService.axiosRef.patch(`${this.config.baseUrl}${path}`, body, {
          headers: this.headers(correlationId),
        }),
      options,
    );
  }

  // DOC-021 3 — primer DELETE de este cliente (documentos_activo admite baja real, a diferencia
  // del resto de recursos oficiales). El body va en `options.data` (axios), mismo patron que
  // post/patch para transportar operadorId/rolesPorOrganizacion.
  private async delete(
    path: string,
    body: unknown,
    correlationId: string,
    options: { passthroughStatuses: number[] },
  ): Promise<unknown> {
    return this.callCore(
      path,
      correlationId,
      () =>
        this.httpService.axiosRef.delete(`${this.config.baseUrl}${path}`, {
          data: body,
          headers: this.headers(correlationId),
        }),
      options,
    );
  }

  private headers(correlationId: string): Record<string, string> {
    return {
      [SERVICE_TOKEN_HEADER]: this.config.serviceToken,
      [CORRELATION_ID_HEADER]: correlationId,
    };
  }

  // Unico punto por el que CIS le habla a CORE — pasa siempre por reintentos con backoff y luego
  // por el circuit breaker (WAF 4: "reintentos con backoff exponencial + limite de intentos" +
  // "si un sistema externo empieza a fallar, el CIS deja de insistir temporalmente"). Reintentar
  // es seguro para las 4 operaciones, incluido POST /inventarios: CORE dedupea por
  // idempotencyKey (DOC-006 3, sesiones_inventario.idempotency_key UNIQUE) — reintentar una
  // request ya aceptada devuelve la misma fila, nunca duplica (WAF 4: "reintentar una operacion
  // de red nunca duplica un alta"). El breaker envuelve la secuencia completa de reintentos: cada
  // request logica cuenta una sola vez para el umbral de fallos consecutivos, no una vez por
  // intento interno.
  private async callCore(
    path: string,
    correlationId: string,
    request: () => Promise<AxiosResponse>,
    options: { passthroughStatuses?: number[] } = {},
  ): Promise<unknown> {
    try {
      const response = await this.breaker.execute(() =>
        withRetry(request, {
          maxAttempts: CORE_RETRY_MAX_ATTEMPTS,
          baseDelayMs: CORE_RETRY_BASE_DELAY_MS,
          shouldRetry: isTransientCoreError,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      if (error instanceof CircuitOpenError) {
        throw new BadGatewayException({
          message: `CORE no disponible (circuito abierto) al pedir ${path}`,
        });
      }
      if (
        error instanceof AxiosError &&
        error.response &&
        options.passthroughStatuses?.includes(error.response.status)
      ) {
        throw this.passthroughError(error.response.status, error.response.data);
      }
      if (error instanceof AxiosError && error.response?.status === 404) {
        throw new NotFoundException(error.response.data);
      }
      // DOC-002 5: 5xx/timeout/sin red es transitorio, no un bug del cliente — se propaga como
      // 502 para que quien llamo a CIS lo trate igual que cualquier otro error transitorio (la
      // causa exacta no se expone, mismo criterio que ZitadelAuthGuard con el 401).
      throw new BadGatewayException({
        message: `No se pudo resolver ${path} contra CORE`,
      });
    }
  }

  private passthroughError(status: number, body: unknown): Error {
    if (status === 400) {
      return new BadRequestException(body);
    }
    if (status === 403) {
      return new ForbiddenException(body);
    }
    // 404 se incluyo explicitamente en passthroughStatuses para varios endpoints nuevos de
    // DOC-021 3 (activos/:id/baja, /reincorporacion, /responsable, /descripcion, /documentos) —
    // sin este caso, cualquiera de esos 404 caia en el default de abajo y se propagaba como
    // ConflictException (409), un bug real encontrado al escribir la cobertura unitaria de estos
    // endpoints (a diferencia de patchContrato/patchResponsableEstado, que no listan 404 en
    // passthroughStatuses y dependen del chequeo explicito de 404 mas abajo en callCore).
    if (status === 404) {
      return new NotFoundException(body);
    }
    return new ConflictException(body);
  }

  private parse<T>(schema: ZodType<T>, data: unknown, label: string): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success || parsed.data === undefined) {
      throw new BadGatewayException({
        message: `CORE devolvió una respuesta de ${label} con forma inesperada`,
      });
    }
    return parsed.data;
  }
}

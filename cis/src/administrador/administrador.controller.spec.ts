/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { AdministradorController } from './administrador.controller';
import { AdministradorService } from './administrador.service';
import {
  ZitadelAuthGuard,
  type AuthenticatedRequest,
  type ZitadelAuthContext,
} from '../common/auth/zitadel-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import type {
  ActivoResult,
  AreaResult,
  AuditoriaEntradaResult,
  ContratoResult,
  ResponsableResult,
  UbicacionResult,
} from '../core-client/core-client.types';
import type {
  ActualizarAreaBody,
  ActualizarContratoBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaContratoBody,
  AltaResponsableBody,
  AltaUbicacionBody,
} from './administrador.schemas';

const CORRELATION_ID = 'correlation-test';

function buildAuthenticatedRequest(
  auth: ZitadelAuthContext,
): AuthenticatedRequest & RequestWithCorrelationId {
  return { auth, correlationId: CORRELATION_ID } as AuthenticatedRequest &
    RequestWithCorrelationId &
    Request;
}

const ACTIVO: ActivoResult = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-1',
  codigoQr: 'QR-1',
  organizacionId: 'duoc-uc',
  areaId: null,
  ubicacionId: null,
  responsableId: null,
  estado: 'activo',
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
  },
};

describe('AdministradorController', () => {
  let controller: AdministradorController;
  let service: jest.Mocked<AdministradorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdministradorController],
      providers: [
        {
          provide: AdministradorService,
          useValue: {
            altaActivo: jest.fn(),
            getContratos: jest.fn(),
            altaContrato: jest.fn(),
            actualizarEstadoContrato: jest.fn(),
            getAuditoria: jest.fn(),
            getAreas: jest.fn(),
            altaArea: jest.fn(),
            actualizarArea: jest.fn(),
            getUbicaciones: jest.fn(),
            altaUbicacion: jest.fn(),
            actualizarUbicacion: jest.fn(),
            getResponsables: jest.fn(),
            altaResponsable: jest.fn(),
            actualizarEstadoResponsable: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ZitadelAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdministradorController);
    service = module.get(AdministradorService);
  });

  it('altaActivo delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaActivo.mockResolvedValue(ACTIVO);
    const body: AltaActivoBody = {
      organizacionId: 'duoc-uc',
      codigoPatrimonial: 'AFT-1',
      codigoQr: 'QR-1',
      catalogoId: 'catalogo-notebook',
    };
    const auth: ZitadelAuthContext = {
      operadorId: 'op-1',
      accessToken: 'zitadel-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'zitadel-org-1': ['administrador-patrimonial'] },
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(controller.altaActivo(body, request)).resolves.toBe(ACTIVO);
    expect(service.altaActivo).toHaveBeenCalledWith(body, auth, CORRELATION_ID);
  });

  const CONTRATO: ContratoResult = {
    id: 'contrato-1',
    organizacionId: 'duoc-uc',
    organizacionNombre: 'DUOC UC',
    sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
    vigenciaDesde: '2026-01-01T00:00:00.000Z',
    vigenciaHasta: null,
    estado: 'vigente',
    modulosContratados: ['inventario-qr'],
  };

  it('getContratos delega en el service con la paginacion y el correlationId', async () => {
    const pagina = { contratos: [CONTRATO], total: 1 };
    service.getContratos.mockResolvedValue(pagina);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(
      controller.getContratos({ limit: 20, offset: 0 }, request),
    ).resolves.toEqual(pagina);
    expect(service.getContratos).toHaveBeenCalledWith(
      { limit: 20, offset: 0 },
      CORRELATION_ID,
    );
  });

  it('getAuditoria delega en el service con la query y el correlationId', async () => {
    const entradas: AuditoriaEntradaResult[] = [
      {
        id: 'audit-1',
        usuario: 'op-1',
        fecha: '2026-08-14T10:00:00.000Z',
        equipo: null,
        ip: null,
        operacion: 'POST /inventarios',
        resultado: 'recibido',
        observaciones: null,
      },
    ];
    const pagina = { entradas, total: entradas.length };
    service.getAuditoria.mockResolvedValue(pagina);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;
    const query = {
      usuario: 'op-1',
      operacion: 'baja',
      limit: 20,
      offset: 0,
    };

    await expect(
      controller.getAuditoria(query, request),
    ).resolves.toEqual(pagina);
    expect(service.getAuditoria).toHaveBeenCalledWith(query, CORRELATION_ID);
  });

  it('altaContrato delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaContrato.mockResolvedValue(CONTRATO);
    const body: AltaContratoBody = {
      organizacionId: 'duoc-uc',
      sedeIds: ['melipilla'],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      modulosContratados: ['inventario-qr'],
    };
    const auth: ZitadelAuthContext = {
      operadorId: 'op-1',
      accessToken: 'zitadel-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'zitadel-org-1': ['administrador-patrimonial'] },
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(controller.altaContrato(body, request)).resolves.toBe(
      CONTRATO,
    );
    expect(service.altaContrato).toHaveBeenCalledWith(
      body,
      auth,
      CORRELATION_ID,
    );
  });

  it('actualizarEstadoContrato delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const suspendido = { ...CONTRATO, estado: 'suspendido' as const };
    service.actualizarEstadoContrato.mockResolvedValue(suspendido);
    const body: ActualizarContratoBody = {
      organizacionId: 'duoc-uc',
      estado: 'suspendido',
    };
    const auth: ZitadelAuthContext = {
      operadorId: 'op-1',
      accessToken: 'zitadel-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'zitadel-org-1': ['administrador-patrimonial'] },
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(
      controller.actualizarEstadoContrato('contrato-1', body, request),
    ).resolves.toBe(suspendido);
    expect(service.actualizarEstadoContrato).toHaveBeenCalledWith(
      'contrato-1',
      body,
      auth,
      CORRELATION_ID,
    );
  });

  const AREA: AreaResult = {
    id: 'area-1',
    organizacionId: 'duoc-uc',
    codigo: 'BIB',
    nombre: 'Biblioteca',
    dependencia: null,
    centroCosto: null,
    responsableId: null,
    ubicacionPrincipalId: null,
  };

  const UBICACION: UbicacionResult = {
    id: 'ubicacion-1',
    sedeId: 'melipilla',
    edificio: null,
    piso: null,
    areaId: null,
    oficina: null,
    dependencia: null,
  };

  const RESPONSABLE: ResponsableResult = {
    id: 'responsable-1',
    identificacion: '11.111.111-1',
    nombre: 'Ana Soto',
    cargo: null,
    areaId: 'area-1',
    correo: null,
    telefono: null,
    estado: 'activo',
  };

  const AUTH: ZitadelAuthContext = {
    operadorId: 'op-1',
    accessToken: 'zitadel-token',
    expiresAt: '2026-08-12T10:15:00.000Z',
    rolesPorOrganizacion: { 'zitadel-org-1': ['administrador-patrimonial'] },
  };

  it('getAreas delega en el service con organizacionId, la paginacion y el correlationId', async () => {
    const pagina = { areas: [AREA], total: 1 };
    service.getAreas.mockResolvedValue(pagina);
    const request = { correlationId: CORRELATION_ID } as RequestWithCorrelationId;

    await expect(
      controller.getAreas(
        { organizacionId: 'duoc-uc', limit: 20, offset: 0 },
        request,
      ),
    ).resolves.toEqual(pagina);
    expect(service.getAreas).toHaveBeenCalledWith(
      'duoc-uc',
      { limit: 20, offset: 0 },
      CORRELATION_ID,
    );
  });

  it('altaArea delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaArea.mockResolvedValue(AREA);
    const body: AltaAreaBody = {
      organizacionId: 'duoc-uc',
      codigo: 'BIB',
      nombre: 'Biblioteca',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaArea(body, request)).resolves.toBe(AREA);
    expect(service.altaArea).toHaveBeenCalledWith(body, AUTH, CORRELATION_ID);
  });

  it('actualizarArea delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const actualizada = { ...AREA, nombre: 'Biblioteca Central' };
    service.actualizarArea.mockResolvedValue(actualizada);
    const body: ActualizarAreaBody = {
      organizacionId: 'duoc-uc',
      nombre: 'Biblioteca Central',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.actualizarArea('area-1', body, request),
    ).resolves.toBe(actualizada);
    expect(service.actualizarArea).toHaveBeenCalledWith(
      'area-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('getUbicaciones delega en el service con sedeId, la paginacion y el correlationId', async () => {
    const pagina = { ubicaciones: [UBICACION], total: 1 };
    service.getUbicaciones.mockResolvedValue(pagina);
    const request = { correlationId: CORRELATION_ID } as RequestWithCorrelationId;

    await expect(
      controller.getUbicaciones(
        { sedeId: 'melipilla', limit: 20, offset: 0 },
        request,
      ),
    ).resolves.toEqual(pagina);
    expect(service.getUbicaciones).toHaveBeenCalledWith(
      'melipilla',
      { limit: 20, offset: 0 },
      CORRELATION_ID,
    );
  });

  it('altaUbicacion delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaUbicacion.mockResolvedValue(UBICACION);
    const body: AltaUbicacionBody = {
      organizacionId: 'duoc-uc',
      sedeId: 'melipilla',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaUbicacion(body, request)).resolves.toBe(
      UBICACION,
    );
    expect(service.altaUbicacion).toHaveBeenCalledWith(
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('actualizarUbicacion delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const actualizada = { ...UBICACION, edificio: 'Torre A' };
    service.actualizarUbicacion.mockResolvedValue(actualizada);
    const body: ActualizarUbicacionBody = {
      organizacionId: 'duoc-uc',
      edificio: 'Torre A',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.actualizarUbicacion('ubicacion-1', body, request),
    ).resolves.toBe(actualizada);
    expect(service.actualizarUbicacion).toHaveBeenCalledWith(
      'ubicacion-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('getResponsables delega en el service con areaId, la paginacion y el correlationId', async () => {
    const pagina = { responsables: [RESPONSABLE], total: 1 };
    service.getResponsables.mockResolvedValue(pagina);
    const request = { correlationId: CORRELATION_ID } as RequestWithCorrelationId;

    await expect(
      controller.getResponsables(
        { areaId: 'area-1', limit: 20, offset: 0 },
        request,
      ),
    ).resolves.toEqual(pagina);
    expect(service.getResponsables).toHaveBeenCalledWith(
      'area-1',
      { limit: 20, offset: 0 },
      CORRELATION_ID,
    );
  });

  it('altaResponsable delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaResponsable.mockResolvedValue(RESPONSABLE);
    const body: AltaResponsableBody = {
      organizacionId: 'duoc-uc',
      identificacion: '11.111.111-1',
      nombre: 'Ana Soto',
      areaId: 'area-1',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaResponsable(body, request)).resolves.toBe(
      RESPONSABLE,
    );
    expect(service.altaResponsable).toHaveBeenCalledWith(
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('actualizarEstadoResponsable delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const inactivo = { ...RESPONSABLE, estado: 'inactivo' as const };
    service.actualizarEstadoResponsable.mockResolvedValue(inactivo);
    const body: ActualizarEstadoResponsableBody = {
      organizacionId: 'duoc-uc',
      estado: 'inactivo',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.actualizarEstadoResponsable('responsable-1', body, request),
    ).resolves.toBe(inactivo);
    expect(service.actualizarEstadoResponsable).toHaveBeenCalledWith(
      'responsable-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });
});

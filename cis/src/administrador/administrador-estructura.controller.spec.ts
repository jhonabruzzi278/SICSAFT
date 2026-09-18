/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { EstructuraAdminController } from './administrador-estructura.controller';
import { AdministradorService } from './administrador.service';
import { KeycloakAuthGuard } from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type {
  AreaResult,
  ResponsableResult,
  UbicacionResult,
} from '../core-client/core-client.types';
import type {
  ActualizarAreaBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AltaAreaBody,
  AltaResponsableBody,
  AltaUbicacionBody,
} from './administrador.schemas';
import {
  AUTH,
  CORRELATION_ID,
  buildAuthenticatedRequest,
  correlationRequest,
} from './administrador-test-helpers';

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

describe('EstructuraAdminController', () => {
  let controller: EstructuraAdminController;
  let service: jest.Mocked<AdministradorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstructuraAdminController],
      providers: [
        {
          provide: AdministradorService,
          useValue: {
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
      .overrideGuard(KeycloakAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EstructuraAdminController);
    service = module.get(AdministradorService);
  });

  it('getAreas delega en el service con organizacionId, la paginacion y el correlationId', async () => {
    const pagina = { areas: [AREA], total: 1 };
    service.getAreas.mockResolvedValue(pagina);
    const request = correlationRequest();

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
    const request = correlationRequest();

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
    const request = correlationRequest();

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

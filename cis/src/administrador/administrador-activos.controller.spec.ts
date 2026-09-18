/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { ActivosAdminController } from './administrador-activos.controller';
import { AdministradorService } from './administrador.service';
import { KeycloakAuthGuard } from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type {
  ActivoResult,
  DocumentoActivoResult,
} from '../core-client/core-client.types';
import type {
  AltaActivoBody,
  AltaDocumentoActivoBody,
  CambioResponsableActivoBody,
  EscrituraOficialActivoBody,
} from './administrador.schemas';
import {
  AUTH,
  CORRELATION_ID,
  buildAuthenticatedRequest,
  correlationRequest,
} from './administrador-test-helpers';

const ACTIVO: ActivoResult = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-1',
  codigoQr: 'QR-1',
  organizacionId: 'duoc-uc',
  areaId: null,
  ubicacionId: null,
  responsableId: null,
  estado: 'activo',
  descripcion: null,
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
  },
};

const DOCUMENTO_ACTIVO: DocumentoActivoResult = {
  id: 'documento-1',
  activoId: 'activo-1',
  organizacionId: 'duoc-uc',
  tipo: 'documento',
  url: 'https://ejemplo.cl/documento.pdf',
  descripcion: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  creadoPor: 'op-1',
};

describe('ActivosAdminController', () => {
  let controller: ActivosAdminController;
  let service: jest.Mocked<AdministradorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivosAdminController],
      providers: [
        {
          provide: AdministradorService,
          useValue: {
            altaActivo: jest.fn(),
            bajaActivo: jest.fn(),
            reincorporarActivo: jest.fn(),
            cambiarResponsableActivo: jest.fn(),
            actualizarDescripcionActivo: jest.fn(),
            getDocumentosActivo: jest.fn(),
            altaDocumentoActivo: jest.fn(),
            eliminarDocumentoActivo: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(KeycloakAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ActivosAdminController);
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
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaActivo(body, request)).resolves.toBe(ACTIVO);
    expect(service.altaActivo).toHaveBeenCalledWith(body, AUTH, CORRELATION_ID);
  });

  // DOC-021 3 (gap "descripciones").
  it('actualizarDescripcionActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const conDescripcion = { ...ACTIVO, descripcion: 'Con rayón' };
    service.actualizarDescripcionActivo.mockResolvedValue(conDescripcion);
    const body = { organizacionId: 'duoc-uc', descripcion: 'Con rayón' };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.actualizarDescripcionActivo('activo-1', body, request),
    ).resolves.toBe(conDescripcion);
    expect(service.actualizarDescripcionActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  // DOC-021 3 (gap "estados").
  it('bajaActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const dadoDeBaja = { ...ACTIVO, estado: 'dado_de_baja' as const };
    service.bajaActivo.mockResolvedValue(dadoDeBaja);
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.bajaActivo('activo-1', body, request),
    ).resolves.toBe(dadoDeBaja);
    expect(service.bajaActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('reincorporarActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    service.reincorporarActivo.mockResolvedValue(ACTIVO);
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.reincorporarActivo('activo-1', body, request),
    ).resolves.toBe(ACTIVO);
    expect(service.reincorporarActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('cambiarResponsableActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const conResponsable = { ...ACTIVO, responsableId: 'responsable-1' };
    service.cambiarResponsableActivo.mockResolvedValue(conResponsable);
    const body: CambioResponsableActivoBody = {
      organizacionId: 'duoc-uc',
      responsableId: 'responsable-1',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.cambiarResponsableActivo('activo-1', body, request),
    ).resolves.toBe(conResponsable);
    expect(service.cambiarResponsableActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  // DOC-021 3 (gap "documentación y fotografías").
  it('getDocumentosActivo delega en el service con el id, organizacionId y el correlationId', async () => {
    service.getDocumentosActivo.mockResolvedValue([DOCUMENTO_ACTIVO]);
    const request = correlationRequest();

    await expect(
      controller.getDocumentosActivo(
        'activo-1',
        { organizacionId: 'duoc-uc' },
        request,
      ),
    ).resolves.toEqual([DOCUMENTO_ACTIVO]);
    expect(service.getDocumentosActivo).toHaveBeenCalledWith(
      'activo-1',
      'duoc-uc',
      CORRELATION_ID,
    );
  });

  it('altaDocumentoActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    service.altaDocumentoActivo.mockResolvedValue(DOCUMENTO_ACTIVO);
    const body: AltaDocumentoActivoBody = {
      organizacionId: 'duoc-uc',
      tipo: 'documento',
      url: 'https://ejemplo.cl/documento.pdf',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.altaDocumentoActivo('activo-1', body, request),
    ).resolves.toBe(DOCUMENTO_ACTIVO);
    expect(service.altaDocumentoActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('eliminarDocumentoActivo delega en el service con el id, documentoId, el body, el auth del guard y el correlationId', async () => {
    service.eliminarDocumentoActivo.mockResolvedValue(undefined);
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };
    const request = buildAuthenticatedRequest(AUTH);

    await controller.eliminarDocumentoActivo(
      'activo-1',
      'documento-1',
      body,
      request,
    );

    expect(service.eliminarDocumentoActivo).toHaveBeenCalledWith(
      'activo-1',
      'documento-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });
});

/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`, mismo
   criterio que qr-connector.controller.spec.ts. */
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardConnectorController } from './dashboard-connector.controller';
import { DashboardConnectorService } from './dashboard-connector.service';
import { ZitadelAuthGuard } from '../common/auth/zitadel-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';

const CORRELATION_ID = 'correlation-test';

function buildRequest(): RequestWithCorrelationId {
  return { correlationId: CORRELATION_ID } as RequestWithCorrelationId;
}

describe('DashboardConnectorController', () => {
  let controller: DashboardConnectorController;
  let service: jest.Mocked<DashboardConnectorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardConnectorController],
      providers: [
        {
          provide: DashboardConnectorService,
          useValue: {
            getCobertura: jest.fn(),
            getAreas: jest.fn(),
            getSesiones: jest.fn(),
            getFueraDeArea: jest.fn(),
            getNoLocalizados: jest.fn(),
            getIncidencias: jest.fn(),
            getEstadoActivos: jest.fn(),
            getCategorias: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ZitadelAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DashboardConnectorController);
    service = module.get(DashboardConnectorService);
  });

  it('getCobertura delega en el service con organizacionId y correlationId', async () => {
    const expected = {
      activosRegistrados: 3,
      activosEscaneados: 1,
      porcentajeCobertura: 0.333,
      actualizadoEn: null,
      alDia: true,
    };
    service.getCobertura.mockResolvedValue(expected);

    await expect(
      controller.getCobertura({ organizacionId: 'duoc-uc' }, buildRequest()),
    ).resolves.toBe(expected);
    expect(service.getCobertura).toHaveBeenCalledWith(
      'duoc-uc',
      CORRELATION_ID,
    );
  });

  it('getAreas delega en el service', async () => {
    const expected = { areas: [], actualizadoEn: null, alDia: true };
    service.getAreas.mockResolvedValue(expected);

    await expect(
      controller.getAreas({ organizacionId: 'duoc-uc' }, buildRequest()),
    ).resolves.toBe(expected);
    expect(service.getAreas).toHaveBeenCalledWith('duoc-uc', CORRELATION_ID);
  });

  it('getSesiones delega en el service con filtros y paginación', async () => {
    const expected = { items: [], total: 0, actualizadoEn: null, alDia: true };
    service.getSesiones.mockResolvedValue(expected);

    await expect(
      controller.getSesiones(
        { organizacionId: 'duoc-uc', areaId: 'area-1', limit: 20, offset: 0 },
        buildRequest(),
      ),
    ).resolves.toBe(expected);
    expect(service.getSesiones).toHaveBeenCalledWith(
      'duoc-uc',
      'area-1',
      20,
      0,
      CORRELATION_ID,
    );
  });

  it('getFueraDeArea delega en el service con filtros y paginación', async () => {
    const expected = { items: [], total: 0, actualizadoEn: null, alDia: true };
    service.getFueraDeArea.mockResolvedValue(expected);

    await expect(
      controller.getFueraDeArea(
        { organizacionId: 'duoc-uc', limit: 20, offset: 0 },
        buildRequest(),
      ),
    ).resolves.toBe(expected);
    expect(service.getFueraDeArea).toHaveBeenCalledWith(
      'duoc-uc',
      undefined,
      20,
      0,
      CORRELATION_ID,
    );
  });

  it('getNoLocalizados delega en el service con paginación', async () => {
    const expected = { items: [], total: 0, actualizadoEn: null, alDia: true };
    service.getNoLocalizados.mockResolvedValue(expected);

    await expect(
      controller.getNoLocalizados(
        { organizacionId: 'duoc-uc', limit: 20, offset: 0 },
        buildRequest(),
      ),
    ).resolves.toBe(expected);
    expect(service.getNoLocalizados).toHaveBeenCalledWith(
      'duoc-uc',
      20,
      0,
      CORRELATION_ID,
    );
  });

  it('getIncidencias delega en el service con filtros y paginación', async () => {
    const expected = { items: [], total: 0, actualizadoEn: null, alDia: true };
    service.getIncidencias.mockResolvedValue(expected);

    await expect(
      controller.getIncidencias(
        {
          organizacionId: 'duoc-uc',
          codigoQr: 'QR-1',
          limit: 20,
          offset: 0,
        },
        buildRequest(),
      ),
    ).resolves.toBe(expected);
    expect(service.getIncidencias).toHaveBeenCalledWith(
      'duoc-uc',
      'QR-1',
      20,
      0,
      CORRELATION_ID,
    );
  });

  it('getEstadoActivos delega en el service', async () => {
    const expected = { estados: [], actualizadoEn: null, alDia: true };
    service.getEstadoActivos.mockResolvedValue(expected);

    await expect(
      controller.getEstadoActivos(
        { organizacionId: 'duoc-uc' },
        buildRequest(),
      ),
    ).resolves.toBe(expected);
    expect(service.getEstadoActivos).toHaveBeenCalledWith(
      'duoc-uc',
      CORRELATION_ID,
    );
  });

  it('getCategorias delega en el service', async () => {
    const expected = { categorias: [], actualizadoEn: null, alDia: true };
    service.getCategorias.mockResolvedValue(expected);

    await expect(
      controller.getCategorias(
        { organizacionId: 'duoc-uc', areaId: 'area-1' },
        buildRequest(),
      ),
    ).resolves.toBe(expected);
    expect(service.getCategorias).toHaveBeenCalledWith(
      'duoc-uc',
      'area-1',
      CORRELATION_ID,
    );
  });
});

/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`, mismo
   criterio que qr-connector.controller.spec.ts. */
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardConnectorController } from './dashboard-connector.controller';
import { DashboardConnectorService } from './dashboard-connector.service';
import { KeycloakAuthGuard } from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import {
  DirectivoGuard,
  type DirectivoRequest,
} from '../directivo/directivo.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';

const CORRELATION_ID = 'correlation-test';

function buildRequest(): RequestWithCorrelationId {
  return { correlationId: CORRELATION_ID } as RequestWithCorrelationId;
}

// revisarSesion lee request.auth directo (requireAuthContext) — los guards están sobreescritos a
// canActivate:()=>true, así que igual que qr-connector.controller.spec.ts, `auth` se arma a mano.
function buildDirectivoRequest(
  operadorId: string,
): DirectivoRequest & RequestWithCorrelationId {
  return {
    correlationId: CORRELATION_ID,
    auth: {
      operadorId,
      accessToken: 'keycloak-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'duoc-uc': ['directivo'] },
    },
    directivoOrganizacionId: 'duoc-uc',
  } as DirectivoRequest & RequestWithCorrelationId;
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
            revisarSesion: jest.fn(),
            getFueraDeArea: jest.fn(),
            getNoLocalizados: jest.fn(),
            getIncidencias: jest.fn(),
            getEstadoActivos: jest.fn(),
            getVeredictos: jest.fn(),
            getCategorias: jest.fn(),
            getHistorico: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(KeycloakAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(DirectivoGuard)
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

  it('revisarSesion delega en el service con sesionId y el operadorId del JWT', async () => {
    const expected = {
      sesionId: 'ses-1',
      areaId: 'area-1',
      veredicto: 'defectuoso',
      fechaCierre: '2026-01-01T00:00:00.000Z',
      revisado: true,
      revisadoPor: 'op-1',
      revisadoEn: '2026-01-02T00:00:00.000Z',
    };
    service.revisarSesion.mockResolvedValue(expected);

    await expect(
      controller.revisarSesion('ses-1', buildDirectivoRequest('op-1')),
    ).resolves.toBe(expected);
    expect(service.revisarSesion).toHaveBeenCalledWith(
      'ses-1',
      'op-1',
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

  it('getVeredictos delega en el service', async () => {
    const expected = {
      dia: { total: 0, porVeredicto: [] },
      acumulado: { total: 0, porVeredicto: [] },
      actualizadoEn: null,
      alDia: true,
    };
    service.getVeredictos.mockResolvedValue(expected);

    await expect(
      controller.getVeredictos({ organizacionId: 'duoc-uc' }, buildRequest()),
    ).resolves.toBe(expected);
    expect(service.getVeredictos).toHaveBeenCalledWith(
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

  it('getHistorico delega en el service (DOC-034 Parte B)', async () => {
    const expected = { items: [], total: 0, actualizadoEn: null, alDia: true };
    service.getHistorico.mockResolvedValue(expected);

    await expect(
      controller.getHistorico(
        {
          organizacionId: 'duoc-uc',
          desde: '2026-09-01',
          hasta: '2026-09-14',
          limit: 20,
          offset: 0,
        },
        buildRequest(),
      ),
    ).resolves.toBe(expected);
    expect(service.getHistorico).toHaveBeenCalledWith(
      'duoc-uc',
      '2026-09-01',
      '2026-09-14',
      20,
      0,
      CORRELATION_ID,
    );
  });
});

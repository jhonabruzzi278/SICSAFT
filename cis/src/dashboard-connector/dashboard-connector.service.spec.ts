/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`, mismo
   criterio que qr-connector.controller.spec.ts. */
import { DashboardConnectorService } from './dashboard-connector.service';
import { CipClientService } from '../cip-client/cip-client.service';

describe('DashboardConnectorService', () => {
  let cipClientService: jest.Mocked<CipClientService>;
  let service: DashboardConnectorService;

  beforeEach(() => {
    cipClientService = {
      getCobertura: jest.fn(),
      getAreas: jest.fn(),
      getSesiones: jest.fn(),
      getFueraDeArea: jest.fn(),
      getNoLocalizados: jest.fn(),
      getIncidencias: jest.fn(),
      getEstadoActivos: jest.fn(),
      getCategorias: jest.fn(),
    } as unknown as jest.Mocked<CipClientService>;
    service = new DashboardConnectorService(cipClientService);
  });

  it('getCobertura delega en CipClientService', async () => {
    const expected = {
      activosRegistrados: 3,
      activosEscaneados: 1,
      porcentajeCobertura: 0.333,
      actualizadoEn: null,
      alDia: true,
    };
    cipClientService.getCobertura.mockResolvedValue(expected);

    await expect(
      service.getCobertura('duoc-uc', 'correlation-test'),
    ).resolves.toBe(expected);
    expect(cipClientService.getCobertura).toHaveBeenCalledWith(
      'duoc-uc',
      'correlation-test',
    );
  });

  it('getAreas delega en CipClientService', async () => {
    const expected = { areas: [], actualizadoEn: null, alDia: true };
    cipClientService.getAreas.mockResolvedValue(expected);

    await expect(service.getAreas('duoc-uc', 'correlation-test')).resolves.toBe(
      expected,
    );
    expect(cipClientService.getAreas).toHaveBeenCalledWith(
      'duoc-uc',
      'correlation-test',
    );
  });

  it('getSesiones delega en CipClientService con paginación', async () => {
    const expected = {
      items: [],
      total: 0,
      actualizadoEn: null,
      alDia: true,
    };
    cipClientService.getSesiones.mockResolvedValue(expected);

    await expect(
      service.getSesiones('duoc-uc', 'area-1', 20, 0, 'correlation-test'),
    ).resolves.toBe(expected);
    expect(cipClientService.getSesiones).toHaveBeenCalledWith(
      'duoc-uc',
      'area-1',
      { limit: 20, offset: 0 },
      'correlation-test',
    );
  });

  it('getFueraDeArea delega en CipClientService con paginación', async () => {
    const expected = { items: [], total: 0, actualizadoEn: null, alDia: true };
    cipClientService.getFueraDeArea.mockResolvedValue(expected);

    await expect(
      service.getFueraDeArea('duoc-uc', undefined, 20, 0, 'correlation-test'),
    ).resolves.toBe(expected);
    expect(cipClientService.getFueraDeArea).toHaveBeenCalledWith(
      'duoc-uc',
      undefined,
      { limit: 20, offset: 0 },
      'correlation-test',
    );
  });

  it('getNoLocalizados delega en CipClientService con paginación', async () => {
    const expected = { items: [], total: 0, actualizadoEn: null, alDia: true };
    cipClientService.getNoLocalizados.mockResolvedValue(expected);

    await expect(
      service.getNoLocalizados('duoc-uc', 20, 0, 'correlation-test'),
    ).resolves.toBe(expected);
    expect(cipClientService.getNoLocalizados).toHaveBeenCalledWith(
      'duoc-uc',
      { limit: 20, offset: 0 },
      'correlation-test',
    );
  });

  it('getIncidencias delega en CipClientService con paginación', async () => {
    const expected = { items: [], total: 0, actualizadoEn: null, alDia: true };
    cipClientService.getIncidencias.mockResolvedValue(expected);

    await expect(
      service.getIncidencias('duoc-uc', 'QR-1', 20, 0, 'correlation-test'),
    ).resolves.toBe(expected);
    expect(cipClientService.getIncidencias).toHaveBeenCalledWith(
      'duoc-uc',
      'QR-1',
      { limit: 20, offset: 0 },
      'correlation-test',
    );
  });

  it('getEstadoActivos delega en CipClientService', async () => {
    const expected = { estados: [], actualizadoEn: null, alDia: true };
    cipClientService.getEstadoActivos.mockResolvedValue(expected);

    await expect(
      service.getEstadoActivos('duoc-uc', 'correlation-test'),
    ).resolves.toBe(expected);
    expect(cipClientService.getEstadoActivos).toHaveBeenCalledWith(
      'duoc-uc',
      'correlation-test',
    );
  });

  it('getCategorias delega en CipClientService', async () => {
    const expected = { categorias: [], actualizadoEn: null, alDia: true };
    cipClientService.getCategorias.mockResolvedValue(expected);

    await expect(
      service.getCategorias('duoc-uc', 'area-1', 'correlation-test'),
    ).resolves.toBe(expected);
    expect(cipClientService.getCategorias).toHaveBeenCalledWith(
      'duoc-uc',
      'area-1',
      'correlation-test',
    );
  });
});

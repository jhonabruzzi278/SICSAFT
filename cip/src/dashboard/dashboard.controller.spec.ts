/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';

const SYNC = { actualizadoEn: '2026-01-01T00:00:00.000Z', alDia: true };

function buildRepository(): jest.Mocked<DashboardRepository> {
  return {
    obtenerCobertura: jest.fn(),
    listarAreas: jest.fn().mockResolvedValue([]),
    listarSesiones: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    listarFueraDeArea: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    listarNoLocalizados: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    listarIncidencias: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    listarEstadoActivos: jest.fn().mockResolvedValue([]),
    listarCategorias: jest.fn().mockResolvedValue([]),
    obtenerSyncInfo: jest.fn().mockResolvedValue(SYNC),
  } as unknown as jest.Mocked<DashboardRepository>;
}

describe('DashboardController', () => {
  it('getCobertura devuelve 0 cuando la organizacion no tiene fila todavía', async () => {
    const repository = buildRepository();
    repository.obtenerCobertura.mockResolvedValue(null);
    const controller = new DashboardController(repository);

    const resultado = await controller.getCobertura({
      organizacionId: 'org-1',
    });

    expect(resultado).toEqual({
      activosRegistrados: 0,
      activosEscaneados: 0,
      porcentajeCobertura: 0,
      ...SYNC,
    });
  });

  it('getCobertura devuelve los datos reales + sync', async () => {
    const repository = buildRepository();
    repository.obtenerCobertura.mockResolvedValue({
      activosRegistrados: 10,
      activosEscaneados: 4,
      porcentajeCobertura: 0.4,
    });
    const controller = new DashboardController(repository);

    const resultado = await controller.getCobertura({
      organizacionId: 'org-1',
    });

    expect(resultado).toEqual({
      activosRegistrados: 10,
      activosEscaneados: 4,
      porcentajeCobertura: 0.4,
      ...SYNC,
    });
  });

  it('getAreas delega en el repositorio y agrega sync', async () => {
    const repository = buildRepository();
    const controller = new DashboardController(repository);

    const resultado = await controller.getAreas({ organizacionId: 'org-1' });

    expect(repository.listarAreas).toHaveBeenCalledWith('org-1');
    expect(resultado).toEqual({ areas: [], ...SYNC });
  });

  it('getSesiones pasa areaId/limit/offset', async () => {
    const repository = buildRepository();
    const controller = new DashboardController(repository);

    const resultado = await controller.getSesiones({
      organizacionId: 'org-1',
      areaId: 'area-1',
      limit: 10,
      offset: 5,
    });

    expect(repository.listarSesiones).toHaveBeenCalledWith(
      'org-1',
      'area-1',
      10,
      5,
    );
    expect(resultado).toEqual({ items: [], total: 0, ...SYNC });
  });

  it('getFueraDeArea pasa areaId/limit/offset', async () => {
    const repository = buildRepository();
    const controller = new DashboardController(repository);

    await controller.getFueraDeArea({
      organizacionId: 'org-1',
      areaId: 'area-1',
      limit: 10,
      offset: 0,
    });

    expect(repository.listarFueraDeArea).toHaveBeenCalledWith(
      'org-1',
      'area-1',
      10,
      0,
    );
  });

  it('getNoLocalizados pasa limit/offset', async () => {
    const repository = buildRepository();
    const controller = new DashboardController(repository);

    await controller.getNoLocalizados({
      organizacionId: 'org-1',
      limit: 10,
      offset: 0,
    });

    expect(repository.listarNoLocalizados).toHaveBeenCalledWith('org-1', 10, 0);
  });

  it('getIncidencias pasa codigoQr/limit/offset', async () => {
    const repository = buildRepository();
    const controller = new DashboardController(repository);

    await controller.getIncidencias({
      organizacionId: 'org-1',
      codigoQr: 'QR-1',
      limit: 10,
      offset: 0,
    });

    expect(repository.listarIncidencias).toHaveBeenCalledWith(
      'org-1',
      'QR-1',
      10,
      0,
    );
  });

  it('getEstadoActivos delega y agrega sync', async () => {
    const repository = buildRepository();
    const controller = new DashboardController(repository);

    const resultado = await controller.getEstadoActivos({
      organizacionId: 'org-1',
    });

    expect(repository.listarEstadoActivos).toHaveBeenCalledWith('org-1');
    expect(resultado).toEqual({ estados: [], ...SYNC });
  });

  it('getCategorias pasa areaId opcional', async () => {
    const repository = buildRepository();
    const controller = new DashboardController(repository);

    const resultado = await controller.getCategorias({
      organizacionId: 'org-1',
      areaId: 'area-1',
    });

    expect(repository.listarCategorias).toHaveBeenCalledWith('org-1', 'area-1');
    expect(resultado).toEqual({ categorias: [], ...SYNC });
  });
});

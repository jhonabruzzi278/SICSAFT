/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { AgregacionService } from './agregacion.service';
import { AgregacionRepository } from './agregacion.repository';
import { CoreClientService } from '../core-client/core-client.service';
import type {
  ActivoCatalogo,
  SesionDetalle,
} from '../core-client/core-client.types';

function buildCoreClient(): jest.Mocked<CoreClientService> {
  return {
    obtenerCatalogoCompleto: jest.fn(),
    obtenerInventarioDetalle: jest.fn(),
  } as unknown as jest.Mocked<CoreClientService>;
}

function buildRepository(): jest.Mocked<AgregacionRepository> {
  return {
    upsertVeredictoSesion: jest.fn().mockResolvedValue(undefined),
    upsertControlArea: jest.fn().mockResolvedValue(undefined),
    marcarEscaneadosAlgunaVez: jest.fn().mockResolvedValue(undefined),
    recalcularCobertura: jest.fn().mockResolvedValue(undefined),
    upsertFueraDeArea: jest.fn().mockResolvedValue(undefined),
    upsertIncidencia: jest.fn().mockResolvedValue(undefined),
    reemplazarEstadoActivoResumen: jest.fn().mockResolvedValue(undefined),
    reemplazarCategoriaActivoResumen: jest.fn().mockResolvedValue(undefined),
    reemplazarActivoNoLocalizado: jest.fn().mockResolvedValue(undefined),
    actualizarSyncEstado: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AgregacionRepository>;
}

function activo(overrides: Partial<ActivoCatalogo> = {}): ActivoCatalogo {
  return {
    codigoQr: 'QR-1',
    nombre: 'Notebook',
    familia: 'Informática',
    organizacionId: 'org-1',
    areaId: 'area-1',
    ubicacionId: 'ubi-1',
    estado: 'activo',
    ...overrides,
  };
}

function sesion(overrides: Partial<SesionDetalle> = {}): SesionDetalle {
  return {
    id: 'ses-1',
    organizacionId: 'org-1',
    areaId: 'area-1',
    ubicacionId: 'ubi-1',
    operadorId: 'op-1',
    fechaInicio: '2026-01-01T00:00:00.000Z',
    fechaCierre: '2026-01-01T01:00:00.000Z',
    estado: 'recibido',
    creadoEn: '2026-01-01T01:00:00.000Z',
    escaneos: [],
    ...overrides,
  };
}

describe('AgregacionService', () => {
  describe('sesion-cerrada', () => {
    it('calcula veredicto exitoso cuando todo lo esperado se escaneó correcto', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      coreClient.obtenerInventarioDetalle.mockResolvedValue(
        sesion({
          escaneos: [
            { codigoQr: 'QR-1', resultado: 'correcto', observaciones: null },
          ],
        }),
      );
      coreClient.obtenerCatalogoCompleto.mockResolvedValue([activo()]);
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'sesion-cerrada',
        sesionId: 'ses-1',
      });

      expect(repository.upsertVeredictoSesion).toHaveBeenCalledWith(
        expect.objectContaining({ veredicto: 'exitoso' }),
      );
      expect(repository.upsertControlArea).toHaveBeenCalledWith(
        'area-1',
        'org-1',
        '2026-01-01T01:00:00.000Z',
      );
      expect(repository.marcarEscaneadosAlgunaVez).toHaveBeenCalledWith(
        'org-1',
        ['QR-1'],
      );
      expect(repository.recalcularCobertura).toHaveBeenCalledWith('org-1', 1);
      expect(repository.actualizarSyncEstado).toHaveBeenCalled();
    });

    it('calcula veredicto aceptable cuando falta un activo esperado', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      coreClient.obtenerInventarioDetalle.mockResolvedValue(
        sesion({ escaneos: [] }),
      );
      coreClient.obtenerCatalogoCompleto.mockResolvedValue([activo()]);
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'sesion-cerrada',
        sesionId: 'ses-1',
      });

      expect(repository.upsertVeredictoSesion).toHaveBeenCalledWith(
        expect.objectContaining({ veredicto: 'aceptable' }),
      );
    });

    it('calcula veredicto defectuoso cuando falta algo y aparece algo fuera de área', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      coreClient.obtenerInventarioDetalle.mockResolvedValue(
        sesion({
          escaneos: [
            {
              codigoQr: 'QR-otra',
              resultado: 'otra_area',
              observaciones: null,
            },
          ],
        }),
      );
      coreClient.obtenerCatalogoCompleto.mockResolvedValue([
        activo({ codigoQr: 'QR-esperado' }),
        activo({ codigoQr: 'QR-otra', areaId: 'area-2' }),
      ]);
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'sesion-cerrada',
        sesionId: 'ses-1',
      });

      expect(repository.upsertVeredictoSesion).toHaveBeenCalledWith(
        expect.objectContaining({ veredicto: 'defectuoso' }),
      );
      expect(repository.upsertFueraDeArea).toHaveBeenCalledWith({
        codigoQr: 'QR-otra',
        organizacionId: 'org-1',
        areaRealId: 'area-1',
        areaEsperadaId: 'area-2',
      });
    });

    it('ignora un escaneo fuera de área si el código no está en el catálogo (defensa en profundidad)', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      coreClient.obtenerInventarioDetalle.mockResolvedValue(
        sesion({
          escaneos: [
            {
              codigoQr: 'QR-desconocido',
              resultado: 'otra_area',
              observaciones: null,
            },
          ],
        }),
      );
      coreClient.obtenerCatalogoCompleto.mockResolvedValue([]);
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'sesion-cerrada',
        sesionId: 'ses-1',
      });

      expect(repository.upsertFueraDeArea).not.toHaveBeenCalled();
    });

    it('registra una incidencia por cada escaneo con_incidencia', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      coreClient.obtenerInventarioDetalle.mockResolvedValue(
        sesion({
          escaneos: [
            {
              codigoQr: 'QR-1',
              resultado: 'con_incidencia',
              observaciones: 'Pantalla rota',
            },
          ],
        }),
      );
      coreClient.obtenerCatalogoCompleto.mockResolvedValue([activo()]);
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'sesion-cerrada',
        sesionId: 'ses-1',
      });

      expect(repository.upsertIncidencia).toHaveBeenCalledWith({
        sesionId: 'ses-1',
        codigoQr: 'QR-1',
        organizacionId: 'org-1',
        observaciones: 'Pantalla rota',
        fecha: '2026-01-01T01:00:00.000Z',
      });
    });

    it('usa cadena vacía si observaciones viene null en un con_incidencia', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      coreClient.obtenerInventarioDetalle.mockResolvedValue(
        sesion({
          escaneos: [
            {
              codigoQr: 'QR-1',
              resultado: 'con_incidencia',
              observaciones: null,
            },
          ],
        }),
      );
      coreClient.obtenerCatalogoCompleto.mockResolvedValue([activo()]);
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'sesion-cerrada',
        sesionId: 'ses-1',
      });

      expect(repository.upsertIncidencia).toHaveBeenCalledWith(
        expect.objectContaining({ observaciones: '' }),
      );
    });
  });

  describe('evento', () => {
    it('recalcula estado_activo_resumen agrupado por estado', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      coreClient.obtenerCatalogoCompleto.mockResolvedValue([
        activo({ codigoQr: 'QR-1', estado: 'activo' }),
        activo({ codigoQr: 'QR-2', estado: 'activo' }),
        activo({ codigoQr: 'QR-3', estado: 'mantenimiento' }),
      ]);
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'evento',
        eventoId: 'ev-1',
        tipo: 'mantenimiento',
        organizacionId: 'org-1',
      });

      expect(repository.reemplazarEstadoActivoResumen).toHaveBeenCalledWith(
        'org-1',
        expect.arrayContaining([
          { estado: 'activo', cantidad: 2 },
          { estado: 'mantenimiento', cantidad: 1 },
        ]),
      );
      expect(repository.actualizarSyncEstado).toHaveBeenCalled();
    });

    it('agrupa categoria_activo_resumen por área y agrega el total "(todas)"', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      coreClient.obtenerCatalogoCompleto.mockResolvedValue([
        activo({ codigoQr: 'QR-1', areaId: 'area-1', familia: 'Informática' }),
        activo({ codigoQr: 'QR-2', areaId: 'area-2', familia: 'Informática' }),
      ]);
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'evento',
        eventoId: 'ev-1',
        tipo: 'alta',
        organizacionId: 'org-1',
      });

      expect(repository.reemplazarCategoriaActivoResumen).toHaveBeenCalledWith(
        'org-1',
        expect.arrayContaining([
          { areaId: 'area-1', familia: 'Informática', cantidad: 1 },
          { areaId: 'area-2', familia: 'Informática', cantidad: 1 },
          { areaId: '(todas)', familia: 'Informática', cantidad: 2 },
        ]),
      );
    });

    it('recalcula activo_no_localizado con los codigoQr en estado extraviado', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      coreClient.obtenerCatalogoCompleto.mockResolvedValue([
        activo({ codigoQr: 'QR-1', estado: 'extraviado' }),
        activo({ codigoQr: 'QR-2', estado: 'activo' }),
      ]);
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'evento',
        eventoId: 'ev-1',
        tipo: 'baja',
        organizacionId: 'org-1',
      });

      expect(repository.reemplazarActivoNoLocalizado).toHaveBeenCalledWith(
        'org-1',
        ['QR-1'],
      );
    });

    it('no hace nada si organizacionId viene null (evento sin activo resuelto)', async () => {
      const coreClient = buildCoreClient();
      const repository = buildRepository();
      const service = new AgregacionService(coreClient, repository);

      await service.procesarMensaje({
        kind: 'evento',
        eventoId: 'ev-1',
        tipo: 'alta',
        organizacionId: null,
      });

      expect(coreClient.obtenerCatalogoCompleto).not.toHaveBeenCalled();
      expect(repository.actualizarSyncEstado).toHaveBeenCalled();
    });
  });
});

/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ImportacionContableLoteService } from './importacion-contable-lote.service';
import { ImportacionContableLoteRepository } from './importacion-contable-lote.repository';
import { ImportacionContableService } from './importacion-contable.service';
import { ResolvedorImportacionService } from './resolvedor-importacion.service';
import type { LoteConFilas } from './importacion-contable-lote.types';

function build() {
  const loteRepository = {
    crear: jest.fn(),
    listar: jest.fn(),
    obtener: jest.fn(),
    marcarRevisado: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ImportacionContableLoteRepository>;
  const importacionContableService = {
    evaluarFila: jest.fn(),
    procesar: jest.fn(),
  } as unknown as jest.Mocked<ImportacionContableService>;
  const resolvedor = {
    resolverCatalogo: jest.fn(),
    resolverArea: jest.fn(),
    resolverResponsable: jest.fn(),
    resolverSoloExistentes: jest.fn().mockResolvedValue({}),
  } as unknown as jest.Mocked<ResolvedorImportacionService>;
  const service = new ImportacionContableLoteService(
    loteRepository,
    importacionContableService,
    resolvedor,
  );
  return { service, loteRepository, importacionContableService, resolvedor };
}

function filaStaging(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    linea: 1,
    codigoPatrimonial: 'DG-001',
    codigoQr: 'DG-001',
    catalogoId: 'cat-1' as string | null,
    serie: null,
    responsableId: 'resp-1' as string | null,
    areaId: 'area-1' as string | null,
    ubicacionId: null,
    valorPatrimonial: 850000,
    direccionNombre: null as string | null,
    areaNombre: null as string | null,
    responsableNombre: null as string | null,
    categoriaNombre: null as string | null,
    nombreAft: null,
    crudo: { CODIGO: 'DG-001' },
    dryRunResultado: 'crear' as const,
    dryRunMotivo: null,
    ...overrides,
  };
}

const LOTE_PENDIENTE: LoteConFilas = {
  lote: {
    id: 'lote-1',
    organizacionId: 'muni',
    origen: 'carpeta',
    archivoNombre: 'activos.xls',
    recibidoEn: '2026-08-31T12:00:00.000Z',
    estado: 'pendiente_revision',
    revisadoPor: null,
    revisadoEn: null,
    motivoRechazo: null,
    resumen: { totalFilas: 1, crear: 1, yaImportado: 0, conflicto: 0 },
  },
  filas: [filaStaging()],
};

describe('ImportacionContableLoteService', () => {
  describe('crearLote', () => {
    it('calcula el dry-run de cada fila y persiste el lote con el motivo correspondiente', async () => {
      const { service, loteRepository, importacionContableService } = build();
      importacionContableService.evaluarFila
        .mockResolvedValueOnce('crear')
        .mockResolvedValueOnce('ya_importado')
        .mockResolvedValueOnce('conflicto');
      loteRepository.crear.mockResolvedValue({
        loteId: 'lote-9',
        resumen: { totalFilas: 3, crear: 1, yaImportado: 1, conflicto: 1 },
      });

      const res = await service.crearLote({
        organizacionId: 'muni',
        origen: 'carpeta',
        archivoNombre: 'activos.xls',
        filas: [
          {
            linea: 1,
            codigoPatrimonial: 'A-1',
            codigoQr: 'A-1',
            catalogoId: 'cat',
            crudo: {},
          },
          {
            linea: 2,
            codigoPatrimonial: 'A-2',
            codigoQr: 'A-2',
            catalogoId: 'cat',
            serie: 'S2',
            areaId: 'area-1',
            responsableId: 'resp-1',
            ubicacionId: 'ubi-1',
            valorPatrimonial: 10,
            crudo: { X: 'y' },
          },
          {
            // Sin catalogoId: llega por categoriaNombre y se resolverá al aprobar.
            linea: 3,
            codigoPatrimonial: 'A-3',
            codigoQr: 'A-3',
            categoriaNombre: 'MOBILIARIO',
            areaNombre: 'PAÑOL',
            responsableNombre: 'JEFE PAÑOL',
            direccionNombre: 'LOGISTICA',
            crudo: {},
          },
        ],
      });

      expect(res.loteId).toBe('lote-9');
      const filasPersistidas = loteRepository.crear.mock.calls[0][0].filas;
      expect(filasPersistidas.map((f) => f.dryRunResultado)).toEqual([
        'crear',
        'ya_importado',
        'conflicto',
      ]);
      expect(filasPersistidas[0].dryRunMotivo).toBeNull();
      expect(filasPersistidas[1].dryRunMotivo).toContain('mismo contenido');
      expect(filasPersistidas[2].dryRunMotivo).toContain('no lo sobrescribe');
      // La fila 3 se persiste con los nombres, sin catalogoId.
      expect(filasPersistidas[2].catalogoId).toBeUndefined();
      expect(filasPersistidas[2].categoriaNombre).toBe('MOBILIARIO');
    });
  });

  describe('listarLotes', () => {
    it('delega en el repositorio', async () => {
      const { service, loteRepository } = build();
      loteRepository.listar.mockResolvedValue([]);
      await service.listarLotes('muni', 'aprobado');
      expect(loteRepository.listar).toHaveBeenCalledWith('muni', 'aprobado');
    });
  });

  it('crearLote sin archivoNombre lo persiste como null', async () => {
    const { service, loteRepository, importacionContableService } = build();
    importacionContableService.evaluarFila.mockResolvedValue('crear');
    loteRepository.crear.mockResolvedValue({
      loteId: 'l',
      resumen: { totalFilas: 1, crear: 1, yaImportado: 0, conflicto: 0 },
    });

    await service.crearLote({
      organizacionId: 'muni',
      origen: 'manual',
      filas: [
        {
          linea: 1,
          codigoPatrimonial: 'A',
          codigoQr: 'A',
          catalogoId: 'c',
          crudo: {},
        },
      ],
    });

    expect(loteRepository.crear.mock.calls[0][0].archivoNombre).toBeNull();
  });

  describe('obtenerLote', () => {
    it('devuelve el lote cuando existe', async () => {
      const { service, loteRepository } = build();
      loteRepository.obtener.mockResolvedValue(LOTE_PENDIENTE);
      expect(await service.obtenerLote('lote-1')).toBe(LOTE_PENDIENTE);
    });

    it('tira NotFound cuando no existe', async () => {
      const { service, loteRepository } = build();
      loteRepository.obtener.mockResolvedValue(null);
      await expect(service.obtenerLote('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('aprobarLote', () => {
    it('ejecuta la importación real con las filas del lote y lo marca aprobado', async () => {
      const { service, loteRepository, importacionContableService } = build();
      loteRepository.obtener.mockResolvedValue(LOTE_PENDIENTE);
      importacionContableService.procesar.mockResolvedValue({
        filas: [{ codigoPatrimonial: 'DG-001', resultado: 'creado' }],
        creados: 1,
        yaImportados: 0,
        conflictos: 0,
      });

      const resultado = await service.aprobarLote('lote-1', 'op-1');

      expect(resultado.creados).toBe(1);
      expect(importacionContableService.procesar).toHaveBeenCalledWith(
        'muni',
        [
          {
            codigoPatrimonial: 'DG-001',
            codigoQr: 'DG-001',
            catalogoId: 'cat-1',
            serie: undefined,
            responsableId: 'resp-1',
            areaId: 'area-1',
            ubicacionId: undefined,
            valorPatrimonial: 850000,
          },
        ],
        'op-1',
      );
      expect(loteRepository.marcarRevisado).toHaveBeenCalledWith(
        'lote-1',
        'aprobado',
        'op-1',
        null,
      );
    });

    it('tira Conflict si el lote ya fue aprobado', async () => {
      const { service, loteRepository } = build();
      loteRepository.obtener.mockResolvedValue({
        ...LOTE_PENDIENTE,
        lote: { ...LOTE_PENDIENTE.lote, estado: 'aprobado' },
      });
      await expect(
        service.aprobarLote('lote-1', 'op-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('resuelve-o-crea catálogo/área/responsable desde los nombres cuando la fila no trae ids', async () => {
      const {
        service,
        loteRepository,
        importacionContableService,
        resolvedor,
      } = build();
      loteRepository.obtener.mockResolvedValue({
        ...LOTE_PENDIENTE,
        filas: [
          filaStaging({
            catalogoId: null,
            categoriaNombre: 'MOBILIARIO',
            areaId: null,
            areaNombre: 'OFICINA DIRECTOR GENERAL',
            direccionNombre: 'DIRECCION GENERAL',
            responsableId: null,
            responsableNombre: 'DIRECTOR GENERAL',
          }),
        ],
      });
      resolvedor.resolverCatalogo.mockResolvedValue('cat-mob');
      resolvedor.resolverArea.mockResolvedValue('area-dg');
      resolvedor.resolverResponsable.mockResolvedValue('resp-dg');
      importacionContableService.procesar.mockResolvedValue({
        filas: [],
        creados: 1,
        yaImportados: 0,
        conflictos: 0,
      });

      await service.aprobarLote('lote-1', 'op-1');

      expect(resolvedor.resolverCatalogo).toHaveBeenCalledWith('MOBILIARIO');
      expect(resolvedor.resolverArea).toHaveBeenCalledWith(
        'muni',
        'OFICINA DIRECTOR GENERAL',
        'DIRECCION GENERAL',
      );
      expect(resolvedor.resolverResponsable).toHaveBeenCalledWith(
        'muni',
        'DIRECTOR GENERAL',
        'area-dg',
      );
      expect(importacionContableService.procesar).toHaveBeenCalledWith(
        'muni',
        [
          expect.objectContaining({
            catalogoId: 'cat-mob',
            areaId: 'area-dg',
            responsableId: 'resp-dg',
          }),
        ],
        'op-1',
      );
    });

    it('no resuelve responsable si no hay área (ni id ni nombre)', async () => {
      const {
        service,
        loteRepository,
        importacionContableService,
        resolvedor,
      } = build();
      loteRepository.obtener.mockResolvedValue({
        ...LOTE_PENDIENTE,
        filas: [
          filaStaging({
            areaId: null,
            areaNombre: null,
            responsableId: null,
            responsableNombre: 'ALGUIEN',
            serie: null,
            valorPatrimonial: null,
            ubicacionId: null,
          }),
        ],
      });
      importacionContableService.procesar.mockResolvedValue({
        filas: [],
        creados: 1,
        yaImportados: 0,
        conflictos: 0,
      });

      await service.aprobarLote('lote-1', 'op-1');

      expect(resolvedor.resolverResponsable).not.toHaveBeenCalled();
      expect(importacionContableService.procesar).toHaveBeenCalledWith(
        'muni',
        [
          expect.objectContaining({
            areaId: undefined,
            responsableId: undefined,
          }),
        ],
        'op-1',
      );
    });
  });

  describe('rechazarLote', () => {
    it('marca el lote rechazado con el motivo', async () => {
      const { service, loteRepository } = build();
      loteRepository.obtener.mockResolvedValue(LOTE_PENDIENTE);

      await service.rechazarLote('lote-1', 'op-1', 'faltan datos');

      expect(loteRepository.marcarRevisado).toHaveBeenCalledWith(
        'lote-1',
        'rechazado',
        'op-1',
        'faltan datos',
      );
    });

    it('acepta rechazo sin motivo', async () => {
      const { service, loteRepository } = build();
      loteRepository.obtener.mockResolvedValue(LOTE_PENDIENTE);

      await service.rechazarLote('lote-1', 'op-1');

      expect(loteRepository.marcarRevisado).toHaveBeenCalledWith(
        'lote-1',
        'rechazado',
        'op-1',
        null,
      );
    });

    it('tira Conflict si el lote ya fue rechazado', async () => {
      const { service, loteRepository } = build();
      loteRepository.obtener.mockResolvedValue({
        ...LOTE_PENDIENTE,
        lote: { ...LOTE_PENDIENTE.lote, estado: 'rechazado' },
      });
      await expect(
        service.rechazarLote('lote-1', 'op-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

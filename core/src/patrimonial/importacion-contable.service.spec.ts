/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { ConflictException } from '@nestjs/common';
import { ImportacionContableService } from './importacion-contable.service';
import { ActivoRepository } from './activo.repository';
import { EventoRepository } from '../eventos/evento.repository';
import type { Activo } from './activo.types';
import type { FilaImportacionContable } from './importacion-contable.types';

const ACTIVO_EXISTENTE: Activo = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-1',
  codigoQr: 'QR-1',
  organizacionId: 'duoc-uc',
  areaId: 'area-biblioteca',
  ubicacionId: 'ubicacion-1',
  responsableId: 'resp-1',
  estado: 'activo',
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
  },
};

const FILA_IGUAL: FilaImportacionContable = {
  codigoPatrimonial: 'AFT-1',
  codigoQr: 'QR-1',
  catalogoId: 'catalogo-notebook',
  areaId: 'area-biblioteca',
  ubicacionId: 'ubicacion-1',
  responsableId: 'resp-1',
};

function buildService() {
  const activoRepository = {
    findByCodigoPatrimonial: jest.fn(),
    crear: jest.fn(),
  } as unknown as jest.Mocked<ActivoRepository>;
  const eventoRepository = {
    registrar: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EventoRepository>;

  const service = new ImportacionContableService(
    activoRepository,
    eventoRepository,
  );

  return { service, activoRepository, eventoRepository };
}

describe('ImportacionContableService', () => {
  it('crea un activo nuevo y registra un evento de alta cuando la fila no existe', async () => {
    const { service, activoRepository, eventoRepository } = buildService();
    activoRepository.findByCodigoPatrimonial.mockResolvedValue(null);
    activoRepository.crear.mockResolvedValue(ACTIVO_EXISTENTE);

    const resultado = await service.procesar(
      'duoc-uc',
      [FILA_IGUAL],
      'op-admin',
    );

    expect(resultado).toEqual({
      filas: [{ codigoPatrimonial: 'AFT-1', resultado: 'creado' }],
      creados: 1,
      yaImportados: 0,
      conflictos: 0,
    });
    expect(activoRepository.crear).toHaveBeenCalledWith({
      ...FILA_IGUAL,
      organizacionId: 'duoc-uc',
    });
    expect(eventoRepository.registrar).toHaveBeenCalledWith({
      activoId: 'activo-1',
      tipo: 'alta',
      usuario: 'op-admin',
      detalle: { codigoPatrimonial: 'AFT-1', origen: 'importacion_contable' },
    });
  });

  it('reporta ya_importado sin escribir cuando la fila ya existe con el mismo contenido (reintento idempotente)', async () => {
    const { service, activoRepository, eventoRepository } = buildService();
    activoRepository.findByCodigoPatrimonial.mockResolvedValue(
      ACTIVO_EXISTENTE,
    );

    const resultado = await service.procesar(
      'duoc-uc',
      [FILA_IGUAL],
      'op-admin',
    );

    expect(resultado).toEqual({
      filas: [{ codigoPatrimonial: 'AFT-1', resultado: 'ya_importado' }],
      creados: 0,
      yaImportados: 1,
      conflictos: 0,
    });
    expect(activoRepository.crear).not.toHaveBeenCalled();
    expect(eventoRepository.registrar).not.toHaveBeenCalled();
  });

  it('reporta conflicto sin escribir cuando la fila ya existe con contenido distinto (nunca sobrescribe en silencio)', async () => {
    const { service, activoRepository, eventoRepository } = buildService();
    activoRepository.findByCodigoPatrimonial.mockResolvedValue(
      ACTIVO_EXISTENTE,
    );

    const resultado = await service.procesar(
      'duoc-uc',
      [{ ...FILA_IGUAL, ubicacionId: 'ubicacion-distinta' }],
      'op-admin',
    );

    expect(resultado.conflictos).toBe(1);
    expect(resultado.filas[0]).toMatchObject({
      codigoPatrimonial: 'AFT-1',
      resultado: 'conflicto',
    });
    expect(activoRepository.crear).not.toHaveBeenCalled();
    expect(eventoRepository.registrar).not.toHaveBeenCalled();
  });

  it('reporta conflicto (sin abortar el resto del archivo) cuando activoRepository.crear falla', async () => {
    const { service, activoRepository } = buildService();
    activoRepository.findByCodigoPatrimonial
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    activoRepository.crear
      .mockRejectedValueOnce(new ConflictException('codigoQr duplicado'))
      .mockResolvedValueOnce(ACTIVO_EXISTENTE);

    const resultado = await service.procesar(
      'duoc-uc',
      [
        FILA_IGUAL,
        { ...FILA_IGUAL, codigoPatrimonial: 'AFT-2', codigoQr: 'QR-2' },
      ],
      'op-admin',
    );

    expect(resultado.creados).toBe(1);
    expect(resultado.conflictos).toBe(1);
    expect(resultado.filas[0]).toMatchObject({
      codigoPatrimonial: 'AFT-1',
      resultado: 'conflicto',
      motivo: 'codigoQr duplicado',
    });
    expect(resultado.filas[1]).toMatchObject({
      codigoPatrimonial: 'AFT-2',
      resultado: 'creado',
    });
  });
});

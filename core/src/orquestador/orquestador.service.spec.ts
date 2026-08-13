/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { ConflictException } from '@nestjs/common';
import { OrquestadorService } from './orquestador.service';
import { InventariosService } from '../inventarios/inventarios.service';
import { AuditoriaRepository } from '../auditoria/auditoria.repository';
import type { InventarioRequest } from '../inventarios/inventarios.types';

function buildPayload(): InventarioRequest {
  return {
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    operadorId: 'op-1',
    organizacionId: 'duoc-uc',
    areaId: 'area-biblioteca',
    ubicacionId: 'ubicacion-biblioteca-101',
    fechaInicio: '2026-01-15T10:00:00.000Z',
    fechaCierre: '2026-01-15T10:30:00.000Z',
    escaneos: [],
    incidencias: [],
  };
}

function buildService() {
  const inventariosService = {
    procesar: jest.fn(),
  } as unknown as jest.Mocked<InventariosService>;
  const auditoriaRepository = {
    registrar: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditoriaRepository>;

  const service = new OrquestadorService(
    inventariosService,
    auditoriaRepository,
  );

  return { service, inventariosService, auditoriaRepository };
}

describe('OrquestadorService', () => {
  it('procesa, audita con el resultado y devuelve la respuesta (camino feliz)', async () => {
    const { service, inventariosService, auditoriaRepository } = buildService();
    inventariosService.procesar.mockResolvedValue({
      inventarioId: 'sesion-1',
      estado: 'recibido',
    });

    const respuesta = await service.procesarInventario(
      buildPayload(),
      'x-corr-http',
    );

    expect(respuesta).toEqual({ inventarioId: 'sesion-1', estado: 'recibido' });
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
      usuario: 'op-1',
      operacion: 'POST /inventarios',
      resultado: 'recibido',
    });
  });

  it('audita el rechazo con el status HTTP y relanza cuando el motor lanza una HttpException', async () => {
    const { service, inventariosService, auditoriaRepository } = buildService();
    inventariosService.procesar.mockRejectedValue(
      new ConflictException('idempotencyKey ya usada'),
    );

    await expect(
      service.procesarInventario(buildPayload(), 'x-corr-http'),
    ).rejects.toThrow(ConflictException);

    expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
      usuario: 'op-1',
      operacion: 'POST /inventarios',
      resultado: 'rechazado:409',
    });
  });

  it('audita como error interno y relanza cuando el motor lanza un error no-HTTP', async () => {
    const { service, inventariosService, auditoriaRepository } = buildService();
    const errorInesperado = new Error('conexion perdida');
    inventariosService.procesar.mockRejectedValue(errorInesperado);

    await expect(
      service.procesarInventario(buildPayload(), 'x-corr-http'),
    ).rejects.toBe(errorInesperado);

    expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
      usuario: 'op-1',
      operacion: 'POST /inventarios',
      resultado: 'rechazado:error-interno',
    });
  });
});

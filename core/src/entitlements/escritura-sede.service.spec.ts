/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { EscrituraSedeService } from './escritura-sede.service';
import { SedeRepository } from './sede.repository';
import type { NuevaSedeInput, Sede } from './sede.types';

describe('EscrituraSedeService', () => {
  it('delega en SedeRepository.crear', async () => {
    const sedeRepository = {
      crear: jest.fn(),
    } as unknown as jest.Mocked<SedeRepository>;
    const service = new EscrituraSedeService(sedeRepository);
    const input: NuevaSedeInput = {
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
    };
    const sede: Sede = { id: 'sede-1', ...input, estado: 'activo' };
    sedeRepository.crear.mockResolvedValue(sede);

    await expect(service.crear(input)).resolves.toBe(sede);
    expect(sedeRepository.crear).toHaveBeenCalledWith(input);
  });

  it('actualizarEstado delega en SedeRepository.actualizarEstado (DOC-024 1)', async () => {
    const sedeRepository = {
      actualizarEstado: jest.fn(),
    } as unknown as jest.Mocked<SedeRepository>;
    const service = new EscrituraSedeService(sedeRepository);
    const sede: Sede = {
      id: 'sede-1',
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
      estado: 'inactivo',
    };
    sedeRepository.actualizarEstado.mockResolvedValue(sede);

    await expect(
      service.actualizarEstado('sede-1', 'duoc-uc', 'inactivo'),
    ).resolves.toBe(sede);
    expect(sedeRepository.actualizarEstado).toHaveBeenCalledWith(
      'sede-1',
      'duoc-uc',
      'inactivo',
    );
  });
});

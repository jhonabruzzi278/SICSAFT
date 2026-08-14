/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { EscrituraEstructuraService } from './escritura-estructura.service';
import { AreaRepository } from './area.repository';
import { UbicacionRepository } from './ubicacion.repository';
import { ResponsableRepository } from './responsable.repository';
import type { Area } from './area.types';
import type { Ubicacion } from './ubicacion.types';
import type { Responsable } from './responsable.types';

const AREA: Area = {
  id: 'area-1',
  organizacionId: 'duoc-uc',
  codigo: 'BIB',
  nombre: 'Biblioteca',
  dependencia: null,
  centroCosto: null,
  responsableId: null,
  ubicacionPrincipalId: null,
};

const UBICACION: Ubicacion = {
  id: 'ubicacion-1',
  sedeId: 'melipilla',
  edificio: null,
  piso: null,
  areaId: null,
  oficina: null,
  dependencia: null,
};

const RESPONSABLE: Responsable = {
  id: 'responsable-1',
  identificacion: '11.111.111-1',
  nombre: 'Ana Soto',
  cargo: null,
  areaId: 'area-1',
  correo: null,
  telefono: null,
  estado: 'activo',
};

function buildService() {
  const areaRepository = {
    crear: jest.fn(),
    findByOrganizacion: jest.fn(),
  } as unknown as jest.Mocked<AreaRepository>;
  const ubicacionRepository = {
    crear: jest.fn(),
    findBySede: jest.fn(),
  } as unknown as jest.Mocked<UbicacionRepository>;
  const responsableRepository = {
    crear: jest.fn(),
    findByArea: jest.fn(),
    actualizarEstado: jest.fn(),
  } as unknown as jest.Mocked<ResponsableRepository>;

  const service = new EscrituraEstructuraService(
    areaRepository,
    ubicacionRepository,
    responsableRepository,
  );

  return { service, areaRepository, ubicacionRepository, responsableRepository };
}

describe('EscrituraEstructuraService', () => {
  it('altaArea delega en AreaRepository.crear', async () => {
    const { service, areaRepository } = buildService();
    areaRepository.crear.mockResolvedValue(AREA);

    const input = { organizacionId: 'duoc-uc', codigo: 'BIB', nombre: 'Biblioteca' };
    await expect(service.altaArea(input)).resolves.toBe(AREA);
    expect(areaRepository.crear).toHaveBeenCalledWith(input);
  });

  it('altaUbicacion delega en UbicacionRepository.crear', async () => {
    const { service, ubicacionRepository } = buildService();
    ubicacionRepository.crear.mockResolvedValue(UBICACION);

    const input = { organizacionId: 'duoc-uc', sedeId: 'melipilla' };
    await expect(service.altaUbicacion(input)).resolves.toBe(UBICACION);
    expect(ubicacionRepository.crear).toHaveBeenCalledWith(input);
  });

  it('altaResponsable delega en ResponsableRepository.crear', async () => {
    const { service, responsableRepository } = buildService();
    responsableRepository.crear.mockResolvedValue(RESPONSABLE);

    const input = {
      organizacionId: 'duoc-uc',
      identificacion: '11.111.111-1',
      nombre: 'Ana Soto',
      areaId: 'area-1',
    };
    await expect(service.altaResponsable(input)).resolves.toBe(RESPONSABLE);
    expect(responsableRepository.crear).toHaveBeenCalledWith(input);
  });

  it('actualizarEstadoResponsable delega en ResponsableRepository.actualizarEstado', async () => {
    const { service, responsableRepository } = buildService();
    const inactivo = { ...RESPONSABLE, estado: 'inactivo' as const };
    responsableRepository.actualizarEstado.mockResolvedValue(inactivo);

    await expect(
      service.actualizarEstadoResponsable('responsable-1', 'duoc-uc', 'inactivo'),
    ).resolves.toBe(inactivo);
    expect(responsableRepository.actualizarEstado).toHaveBeenCalledWith(
      'responsable-1',
      'duoc-uc',
      'inactivo',
    );
  });
});

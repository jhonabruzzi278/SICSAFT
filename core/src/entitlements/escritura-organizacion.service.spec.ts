/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { EscrituraOrganizacionService } from './escritura-organizacion.service';
import { OrganizacionRepository } from './organizacion.repository';
import type {
  NuevaOrganizacionInput,
  Organizacion,
} from './organizacion.types';

describe('EscrituraOrganizacionService', () => {
  describe('crear', () => {
    it('delega en OrganizacionRepository.crear con el input', async () => {
      const organizacionRepository = {
        crear: jest.fn(),
      } as unknown as jest.Mocked<OrganizacionRepository>;
      const service = new EscrituraOrganizacionService(organizacionRepository);
      const input: NuevaOrganizacionInput = {
        id: 'duoc-uc',
        nombre: 'DUOC UC',
      };
      const organizacion: Organizacion = {
        id: 'duoc-uc',
        nombre: 'DUOC UC',
        estado: 'activo',
      };
      organizacionRepository.crear.mockResolvedValue(organizacion);

      await expect(service.crear(input)).resolves.toBe(organizacion);
      expect(organizacionRepository.crear).toHaveBeenCalledWith(input);
    });
  });

  describe('actualizarNombre', () => {
    it('delega en OrganizacionRepository.actualizarNombre (DOC-024 1)', async () => {
      const organizacionRepository = {
        actualizarNombre: jest.fn(),
      } as unknown as jest.Mocked<OrganizacionRepository>;
      const service = new EscrituraOrganizacionService(organizacionRepository);
      const organizacion: Organizacion = {
        id: 'duoc-uc',
        nombre: 'DUOC UC (renombrada)',
        estado: 'activo',
      };
      organizacionRepository.actualizarNombre.mockResolvedValue(organizacion);

      await expect(
        service.actualizarNombre('duoc-uc', 'DUOC UC (renombrada)'),
      ).resolves.toBe(organizacion);
      expect(organizacionRepository.actualizarNombre).toHaveBeenCalledWith(
        'duoc-uc',
        'DUOC UC (renombrada)',
      );
    });
  });

  describe('actualizarEstado', () => {
    it('delega en OrganizacionRepository.actualizarEstado (DOC-024 1)', async () => {
      const organizacionRepository = {
        actualizarEstado: jest.fn(),
      } as unknown as jest.Mocked<OrganizacionRepository>;
      const service = new EscrituraOrganizacionService(organizacionRepository);
      const organizacion: Organizacion = {
        id: 'duoc-uc',
        nombre: 'DUOC UC',
        estado: 'inactivo',
      };
      organizacionRepository.actualizarEstado.mockResolvedValue(organizacion);

      await expect(
        service.actualizarEstado('duoc-uc', 'inactivo'),
      ).resolves.toBe(organizacion);
      expect(organizacionRepository.actualizarEstado).toHaveBeenCalledWith(
        'duoc-uc',
        'inactivo',
      );
    });
  });
});

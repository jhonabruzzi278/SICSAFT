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
      const organizacion: Organizacion = { id: 'duoc-uc', nombre: 'DUOC UC' };
      organizacionRepository.crear.mockResolvedValue(organizacion);

      await expect(service.crear(input)).resolves.toBe(organizacion);
      expect(organizacionRepository.crear).toHaveBeenCalledWith(input);
    });
  });
});

import type { Redis } from 'ioredis';
import { OrganizacionMappingDinamicoService } from './organizacion-mapping-dinamico.service';

describe('OrganizacionMappingDinamicoService', () => {
  let redis: jest.Mocked<Pick<Redis, 'mset' | 'get'>>;
  let service: OrganizacionMappingDinamicoService;

  beforeEach(() => {
    redis = { mset: jest.fn(), get: jest.fn() };
    service = new OrganizacionMappingDinamicoService(redis as unknown as Redis);
  });

  describe('registrar', () => {
    it('registra el mapeo en ambos sentidos con un solo MSET', async () => {
      redis.mset.mockResolvedValue('OK');

      await service.registrar('zitadel-org-1', 'org-1');

      expect(redis.mset).toHaveBeenCalledWith(
        'organizacion-mapping:zitadel-a-core:zitadel-org-1',
        'org-1',
        'organizacion-mapping:core-a-zitadel:org-1',
        'zitadel-org-1',
      );
    });

    it('propaga el error si Redis falla (no es una restriccion de negocio complementaria)', async () => {
      redis.mset.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.registrar('zitadel-org-1', 'org-1')).rejects.toThrow(
        'ECONNREFUSED',
      );
    });
  });

  describe('resolverOrganizacionId', () => {
    it('devuelve el organizacionId de CORE mapeado', async () => {
      redis.get.mockResolvedValue('org-1');

      const resultado = await service.resolverOrganizacionId('zitadel-org-1');

      expect(redis.get).toHaveBeenCalledWith(
        'organizacion-mapping:zitadel-a-core:zitadel-org-1',
      );
      expect(resultado).toBe('org-1');
    });

    it('devuelve null si no hay mapeo registrado', async () => {
      redis.get.mockResolvedValue(null);

      const resultado = await service.resolverOrganizacionId('zitadel-org-x');

      expect(resultado).toBeNull();
    });

    it('devuelve null (no propaga) si Redis falla', async () => {
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'));

      const resultado = await service.resolverOrganizacionId('zitadel-org-1');

      expect(resultado).toBeNull();
    });
  });

  describe('resolverZitadelOrgId', () => {
    it('devuelve el id de Zitadel mapeado', async () => {
      redis.get.mockResolvedValue('zitadel-org-1');

      const resultado = await service.resolverZitadelOrgId('org-1');

      expect(redis.get).toHaveBeenCalledWith(
        'organizacion-mapping:core-a-zitadel:org-1',
      );
      expect(resultado).toBe('zitadel-org-1');
    });

    it('devuelve null si no hay mapeo registrado', async () => {
      redis.get.mockResolvedValue(null);

      const resultado = await service.resolverZitadelOrgId('org-x');

      expect(resultado).toBeNull();
    });

    it('devuelve null (no propaga) si Redis falla', async () => {
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'));

      const resultado = await service.resolverZitadelOrgId('org-1');

      expect(resultado).toBeNull();
    });
  });
});

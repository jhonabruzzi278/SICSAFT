/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { AdministradorService } from './administrador.service';
import { CoreClientService } from '../core-client/core-client.service';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import type {
  ActivoResult,
  ContratoResult,
} from '../core-client/core-client.types';
import type {
  ActualizarContratoBody,
  AltaActivoBody,
  AltaContratoBody,
} from './administrador.schemas';

const ACTIVO: ActivoResult = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-1',
  codigoQr: 'QR-1',
  organizacionId: 'duoc-uc',
  areaId: null,
  ubicacionId: null,
  responsableId: null,
  estado: 'activo',
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
  },
};

const CONTRATO: ContratoResult = {
  id: 'contrato-1',
  organizacionId: 'duoc-uc',
  organizacionNombre: 'DUOC UC',
  sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
  vigenciaDesde: '2026-01-01T00:00:00.000Z',
  vigenciaHasta: null,
  estado: 'vigente',
  modulosContratados: ['inventario-qr'],
};

function buildService(mapping: Record<string, string>) {
  const coreClientService = {
    postActivo: jest.fn(),
    getContratos: jest.fn(),
    postContrato: jest.fn(),
    patchContrato: jest.fn(),
  } as unknown as jest.Mocked<CoreClientService>;
  const service = new AdministradorService(coreClientService, mapping);
  return { service, coreClientService };
}

const AUTH: ZitadelAuthContext = {
  operadorId: 'op-1',
  accessToken: 'token-1',
  expiresAt: '2026-01-01T00:00:00.000Z',
  rolesPorOrganizacion: {
    '386029528616558597': ['administrador-patrimonial'],
  },
};

describe('AdministradorService', () => {
  describe('altaActivo', () => {
    const body: AltaActivoBody = {
      organizacionId: 'duoc-uc',
      codigoPatrimonial: 'AFT-1',
      codigoQr: 'QR-1',
      catalogoId: 'catalogo-notebook',
    };
    const auth: ZitadelAuthContext = {
      operadorId: 'op-1',
      accessToken: 'token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
      rolesPorOrganizacion: {
        '386029528616558597': ['administrador-patrimonial'],
      },
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postActivo.mockResolvedValue(ACTIVO);

      const activo = await service.altaActivo(body, auth, 'corr-1');

      expect(activo).toBe(ACTIVO);
      expect(coreClientService.postActivo).toHaveBeenCalledWith(
        {
          ...body,
          correlationId: 'corr-1',
          operadorId: 'op-1',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        },
        'corr-1',
      );
    });

    it('omite organizaciones sin entrada en el mapeo (nunca inventa una clave)', async () => {
      const { service, coreClientService } = buildService({});
      coreClientService.postActivo.mockResolvedValue(ACTIVO);

      await service.altaActivo(body, auth, 'corr-1');

      expect(coreClientService.postActivo).toHaveBeenCalledWith(
        expect.objectContaining({ rolesPorOrganizacion: {} }),
        'corr-1',
      );
    });
  });

  describe('getContratos', () => {
    it('delega en CoreClientService.getContratos sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService({});
      coreClientService.getContratos.mockResolvedValue([CONTRATO]);

      await expect(service.getContratos('corr-1')).resolves.toEqual([CONTRATO]);
      expect(coreClientService.getContratos).toHaveBeenCalledWith('corr-1');
    });
  });

  describe('altaContrato', () => {
    const body: AltaContratoBody = {
      organizacionId: 'duoc-uc',
      sedeIds: ['melipilla'],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      modulosContratados: ['inventario-qr'],
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postContrato.mockResolvedValue(CONTRATO);

      const contrato = await service.altaContrato(body, AUTH, 'corr-1');

      expect(contrato).toBe(CONTRATO);
      expect(coreClientService.postContrato).toHaveBeenCalledWith(
        {
          ...body,
          correlationId: 'corr-1',
          operadorId: 'op-1',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        },
        'corr-1',
      );
    });
  });

  describe('actualizarEstadoContrato', () => {
    const body: ActualizarContratoBody = {
      organizacionId: 'duoc-uc',
      estado: 'suspendido',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const suspendido = { ...CONTRATO, estado: 'suspendido' as const };
      coreClientService.patchContrato.mockResolvedValue(suspendido);

      const contrato = await service.actualizarEstadoContrato(
        'contrato-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(contrato).toBe(suspendido);
      expect(coreClientService.patchContrato).toHaveBeenCalledWith(
        'contrato-1',
        {
          ...body,
          correlationId: 'corr-1',
          operadorId: 'op-1',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        },
        'corr-1',
      );
    });
  });
});

/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { AdministradorService } from './administrador.service';
import { CoreClientService } from '../core-client/core-client.service';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import type {
  ActivoResult,
  AreaResult,
  AuditoriaEntradaResult,
  ContratoResult,
  ResponsableResult,
  UbicacionResult,
} from '../core-client/core-client.types';
import type {
  ActualizarContratoBody,
  ActualizarEstadoResponsableBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaContratoBody,
  AltaResponsableBody,
  AltaUbicacionBody,
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
    getAuditoria: jest.fn(),
    getAreas: jest.fn(),
    postArea: jest.fn(),
    getUbicaciones: jest.fn(),
    postUbicacion: jest.fn(),
    getResponsables: jest.fn(),
    postResponsable: jest.fn(),
    patchResponsableEstado: jest.fn(),
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

  describe('getAuditoria', () => {
    it('delega en CoreClientService.getAuditoria sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService({});
      const entradas: AuditoriaEntradaResult[] = [
        {
          id: 'audit-1',
          usuario: 'op-1',
          fecha: '2026-08-14T10:00:00.000Z',
          equipo: null,
          ip: null,
          operacion: 'POST /inventarios',
          resultado: 'recibido',
          observaciones: null,
        },
      ];
      coreClientService.getAuditoria.mockResolvedValue(entradas);

      await expect(service.getAuditoria('corr-1')).resolves.toEqual(entradas);
      expect(coreClientService.getAuditoria).toHaveBeenCalledWith('corr-1');
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

  const AREA: AreaResult = {
    id: 'area-1',
    organizacionId: 'duoc-uc',
    codigo: 'BIB',
    nombre: 'Biblioteca',
    dependencia: null,
    centroCosto: null,
    responsableId: null,
    ubicacionPrincipalId: null,
  };

  const UBICACION: UbicacionResult = {
    id: 'ubicacion-1',
    sedeId: 'melipilla',
    edificio: null,
    piso: null,
    areaId: null,
    oficina: null,
    dependencia: null,
  };

  const RESPONSABLE: ResponsableResult = {
    id: 'responsable-1',
    identificacion: '11.111.111-1',
    nombre: 'Ana Soto',
    cargo: null,
    areaId: 'area-1',
    correo: null,
    telefono: null,
    estado: 'activo',
  };

  describe('getAreas', () => {
    it('delega en CoreClientService.getAreas sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService({});
      coreClientService.getAreas.mockResolvedValue([AREA]);

      await expect(service.getAreas('duoc-uc', 'corr-1')).resolves.toEqual([
        AREA,
      ]);
      expect(coreClientService.getAreas).toHaveBeenCalledWith(
        'duoc-uc',
        'corr-1',
      );
    });
  });

  describe('altaArea', () => {
    const body: AltaAreaBody = {
      organizacionId: 'duoc-uc',
      codigo: 'BIB',
      nombre: 'Biblioteca',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postArea.mockResolvedValue(AREA);

      const area = await service.altaArea(body, AUTH, 'corr-1');

      expect(area).toBe(AREA);
      expect(coreClientService.postArea).toHaveBeenCalledWith(
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

  describe('getUbicaciones', () => {
    it('delega en CoreClientService.getUbicaciones sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService({});
      coreClientService.getUbicaciones.mockResolvedValue([UBICACION]);

      await expect(
        service.getUbicaciones('melipilla', 'corr-1'),
      ).resolves.toEqual([UBICACION]);
      expect(coreClientService.getUbicaciones).toHaveBeenCalledWith(
        'melipilla',
        'corr-1',
      );
    });
  });

  describe('altaUbicacion', () => {
    const body: AltaUbicacionBody = {
      organizacionId: 'duoc-uc',
      sedeId: 'melipilla',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postUbicacion.mockResolvedValue(UBICACION);

      const ubicacion = await service.altaUbicacion(body, AUTH, 'corr-1');

      expect(ubicacion).toBe(UBICACION);
      expect(coreClientService.postUbicacion).toHaveBeenCalledWith(
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

  describe('getResponsables', () => {
    it('delega en CoreClientService.getResponsables sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService({});
      coreClientService.getResponsables.mockResolvedValue([RESPONSABLE]);

      await expect(
        service.getResponsables('area-1', 'corr-1'),
      ).resolves.toEqual([RESPONSABLE]);
      expect(coreClientService.getResponsables).toHaveBeenCalledWith(
        'area-1',
        'corr-1',
      );
    });
  });

  describe('altaResponsable', () => {
    const body: AltaResponsableBody = {
      organizacionId: 'duoc-uc',
      identificacion: '11.111.111-1',
      nombre: 'Ana Soto',
      areaId: 'area-1',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postResponsable.mockResolvedValue(RESPONSABLE);

      const responsable = await service.altaResponsable(body, AUTH, 'corr-1');

      expect(responsable).toBe(RESPONSABLE);
      expect(coreClientService.postResponsable).toHaveBeenCalledWith(
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

  describe('actualizarEstadoResponsable', () => {
    const body: ActualizarEstadoResponsableBody = {
      organizacionId: 'duoc-uc',
      estado: 'inactivo',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const inactivo = { ...RESPONSABLE, estado: 'inactivo' as const };
      coreClientService.patchResponsableEstado.mockResolvedValue(inactivo);

      const responsable = await service.actualizarEstadoResponsable(
        'responsable-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(responsable).toBe(inactivo);
      expect(coreClientService.patchResponsableEstado).toHaveBeenCalledWith(
        'responsable-1',
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

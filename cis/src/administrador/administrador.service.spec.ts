/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { NotFoundException } from '@nestjs/common';
import { AdministradorService } from './administrador.service';
import { CoreClientService } from '../core-client/core-client.service';
import { ZitadelAdminService } from '../zitadel-admin/zitadel-admin.service';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import type { GrantUsuario } from '../zitadel-admin/zitadel-admin.types';
import type {
  ActivoResult,
  AreaResult,
  AuditoriaEntradaResult,
  CatalogoTipoResult,
  ContratoResult,
  DocumentoActivoResult,
  ImportacionContableResult,
  IndicadoresResult,
  OrganizacionResult,
  ResponsableResult,
  UbicacionResult,
} from '../core-client/core-client.types';
import type {
  ActualizarAreaBody,
  ActualizarContratoBody,
  ActualizarDescripcionActivoBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaContratoBody,
  AltaDocumentoActivoBody,
  AltaOrganizacionBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  AsignarUsuarioOrganizacionBody,
  CambioResponsableActivoBody,
  EscrituraOficialActivoBody,
  ImportacionContableBody,
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
  descripcion: null,
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
    postActivoBaja: jest.fn(),
    postActivoReincorporacion: jest.fn(),
    patchActivoResponsable: jest.fn(),
    patchActivoDescripcion: jest.fn(),
    getCatalogoTipos: jest.fn(),
    postCatalogoTipo: jest.fn(),
    getDocumentosActivo: jest.fn(),
    postDocumentoActivo: jest.fn(),
    deleteDocumentoActivo: jest.fn(),
    postImportacionContable: jest.fn(),
    getOrganizaciones: jest.fn(),
    postOrganizacion: jest.fn(),
    getIndicadores: jest.fn(),
    getContratos: jest.fn(),
    postContrato: jest.fn(),
    patchContrato: jest.fn(),
    getAuditoria: jest.fn(),
    getAreas: jest.fn(),
    postArea: jest.fn(),
    patchArea: jest.fn(),
    getUbicaciones: jest.fn(),
    postUbicacion: jest.fn(),
    patchUbicacion: jest.fn(),
    getResponsables: jest.fn(),
    postResponsable: jest.fn(),
    patchResponsableEstado: jest.fn(),
  } as unknown as jest.Mocked<CoreClientService>;
  const zitadelAdminService = {
    buscarUsuarioPorEmail: jest.fn(),
    listarGrants: jest.fn(),
    crearGrant: jest.fn(),
  } as unknown as jest.Mocked<ZitadelAdminService>;
  const service = new AdministradorService(
    coreClientService,
    zitadelAdminService,
    mapping,
  );
  return { service, coreClientService, zitadelAdminService };
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

  describe('bajaActivo', () => {
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const dadoDeBaja = { ...ACTIVO, estado: 'dado_de_baja' as const };
      coreClientService.postActivoBaja.mockResolvedValue(dadoDeBaja);

      const activo = await service.bajaActivo('activo-1', body, AUTH, 'corr-1');

      expect(activo).toBe(dadoDeBaja);
      expect(coreClientService.postActivoBaja).toHaveBeenCalledWith(
        'activo-1',
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

  describe('reincorporarActivo', () => {
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postActivoReincorporacion.mockResolvedValue(ACTIVO);

      const activo = await service.reincorporarActivo(
        'activo-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(activo).toBe(ACTIVO);
      expect(coreClientService.postActivoReincorporacion).toHaveBeenCalledWith(
        'activo-1',
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

  describe('cambiarResponsableActivo', () => {
    const body: CambioResponsableActivoBody = {
      organizacionId: 'duoc-uc',
      responsableId: 'responsable-1',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const conResponsable = { ...ACTIVO, responsableId: 'responsable-1' };
      coreClientService.patchActivoResponsable.mockResolvedValue(
        conResponsable,
      );

      const activo = await service.cambiarResponsableActivo(
        'activo-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(activo).toBe(conResponsable);
      expect(coreClientService.patchActivoResponsable).toHaveBeenCalledWith(
        'activo-1',
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

  describe('actualizarDescripcionActivo', () => {
    const body: ActualizarDescripcionActivoBody = {
      organizacionId: 'duoc-uc',
      descripcion: 'Con rayón',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const conDescripcion = { ...ACTIVO, descripcion: 'Con rayón' };
      coreClientService.patchActivoDescripcion.mockResolvedValue(
        conDescripcion,
      );

      const activo = await service.actualizarDescripcionActivo(
        'activo-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(activo).toBe(conDescripcion);
      expect(coreClientService.patchActivoDescripcion).toHaveBeenCalledWith(
        'activo-1',
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

  const CATALOGO_TIPO: CatalogoTipoResult = {
    id: 'catalogo-1',
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
    fabricante: null,
    vidaUtilMeses: null,
    criticidad: 'media',
    tecnologiaIdentificacion: 'qr',
  };

  describe('getCatalogoTipos', () => {
    it('delega en CoreClientService.getCatalogoTipos sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService({});
      coreClientService.getCatalogoTipos.mockResolvedValue([CATALOGO_TIPO]);

      await expect(service.getCatalogoTipos('corr-1')).resolves.toEqual([
        CATALOGO_TIPO,
      ]);
      expect(coreClientService.getCatalogoTipos).toHaveBeenCalledWith('corr-1');
    });
  });

  describe('altaCatalogoTipo', () => {
    const body: AltaCatalogoTipoBody = {
      organizacionId: 'duoc-uc',
      tipo: 'Equipo Computacional',
      familia: 'Informática',
      criticidad: 'media',
      tecnologiaIdentificacion: 'qr',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postCatalogoTipo.mockResolvedValue(CATALOGO_TIPO);

      const catalogoTipo = await service.altaCatalogoTipo(body, AUTH, 'corr-1');

      expect(catalogoTipo).toBe(CATALOGO_TIPO);
      expect(coreClientService.postCatalogoTipo).toHaveBeenCalledWith(
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

  const DOCUMENTO_ACTIVO: DocumentoActivoResult = {
    id: 'documento-1',
    activoId: 'activo-1',
    organizacionId: 'duoc-uc',
    tipo: 'documento',
    url: 'https://ejemplo.cl/documento.pdf',
    descripcion: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    creadoPor: 'op-1',
  };

  describe('getDocumentosActivo', () => {
    it('delega en CoreClientService.getDocumentosActivo con activoId y organizacionId', async () => {
      const { service, coreClientService } = buildService({});
      coreClientService.getDocumentosActivo.mockResolvedValue([
        DOCUMENTO_ACTIVO,
      ]);

      await expect(
        service.getDocumentosActivo('activo-1', 'duoc-uc', 'corr-1'),
      ).resolves.toEqual([DOCUMENTO_ACTIVO]);
      expect(coreClientService.getDocumentosActivo).toHaveBeenCalledWith(
        'activo-1',
        'duoc-uc',
        'corr-1',
      );
    });
  });

  describe('altaDocumentoActivo', () => {
    const body: AltaDocumentoActivoBody = {
      organizacionId: 'duoc-uc',
      tipo: 'documento',
      url: 'https://ejemplo.cl/documento.pdf',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postDocumentoActivo.mockResolvedValue(DOCUMENTO_ACTIVO);

      const documento = await service.altaDocumentoActivo(
        'activo-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(documento).toBe(DOCUMENTO_ACTIVO);
      expect(coreClientService.postDocumentoActivo).toHaveBeenCalledWith(
        'activo-1',
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

  describe('eliminarDocumentoActivo', () => {
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.deleteDocumentoActivo.mockResolvedValue(undefined);

      await service.eliminarDocumentoActivo(
        'activo-1',
        'documento-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(coreClientService.deleteDocumentoActivo).toHaveBeenCalledWith(
        'activo-1',
        'documento-1',
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

  describe('importarContable', () => {
    const body: ImportacionContableBody = {
      organizacionId: 'duoc-uc',
      filas: [
        {
          codigoPatrimonial: 'AFT-1',
          codigoQr: 'QR-1',
          catalogoId: 'catalogo-notebook',
        },
      ],
    };
    const resultado: ImportacionContableResult = {
      filas: [{ codigoPatrimonial: 'AFT-1', resultado: 'creado' }],
      creados: 1,
      yaImportados: 0,
      conflictos: 0,
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postImportacionContable.mockResolvedValue(resultado);

      const importado = await service.importarContable(body, AUTH, 'corr-1');

      expect(importado).toBe(resultado);
      expect(coreClientService.postImportacionContable).toHaveBeenCalledWith(
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

  const ORGANIZACION: OrganizacionResult = {
    id: 'duoc-uc',
    nombre: 'DUOC UC',
  };

  describe('getOrganizaciones', () => {
    it('delega en CoreClientService.getOrganizaciones sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService({});
      coreClientService.getOrganizaciones.mockResolvedValue([ORGANIZACION]);

      await expect(service.getOrganizaciones('corr-1')).resolves.toEqual([
        ORGANIZACION,
      ]);
      expect(coreClientService.getOrganizaciones).toHaveBeenCalledWith(
        'corr-1',
      );
    });
  });

  describe('altaOrganizacion', () => {
    const body: AltaOrganizacionBody = {
      id: 'zitadel-org-nueva',
      nombre: 'Nueva Organización',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService, sin exigir organizacionId propio (DOC-022 3)', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postOrganizacion.mockResolvedValue(ORGANIZACION);

      const organizacion = await service.altaOrganizacion(body, AUTH, 'corr-1');

      expect(organizacion).toBe(ORGANIZACION);
      expect(coreClientService.postOrganizacion).toHaveBeenCalledWith(
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

  describe('getIndicadores', () => {
    it('delega en CoreClientService.getIndicadores sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService({});
      const indicadores: IndicadoresResult = {
        totalOrganizaciones: 1,
        totalSedes: 1,
        contratosPorEstado: {
          vigente: 1,
          suspendido: 0,
          vencido: 0,
          cancelado: 0,
        },
      };
      coreClientService.getIndicadores.mockResolvedValue(indicadores);

      await expect(service.getIndicadores('corr-1')).resolves.toEqual(
        indicadores,
      );
      expect(coreClientService.getIndicadores).toHaveBeenCalledWith('corr-1');
    });
  });

  describe('listarUsuariosOrganizacion', () => {
    it('traduce organizacionId de CORE al id de Zitadel antes de llamar a ZitadelAdminService', async () => {
      const { service, zitadelAdminService } = buildService({
        'zitadel-org-1': 'duoc-uc',
      });
      const grants: GrantUsuario[] = [
        {
          userId: 'usuario-1',
          email: 'usuario@duoc.cl',
          displayName: 'Usuario Uno',
          roles: ['administrador-patrimonial'],
        },
      ];
      zitadelAdminService.listarGrants.mockResolvedValue(grants);

      await expect(
        service.listarUsuariosOrganizacion('duoc-uc', 'corr-1'),
      ).resolves.toEqual(grants);
      expect(zitadelAdminService.listarGrants).toHaveBeenCalledWith(
        'zitadel-org-1',
        'corr-1',
      );
    });

    it('lanza NotFoundException cuando organizacionId no tiene mapeo a un id de Zitadel', () => {
      const { service } = buildService({});

      // La traduccion Core->Zitadel es sincronica (organizacionIdAZitadel), el metodo lanza
      // antes de devolver una Promise — no una rejection.
      expect(() =>
        service.listarUsuariosOrganizacion('sin-mapeo', 'corr-1'),
      ).toThrow(NotFoundException);
    });
  });

  describe('asignarUsuarioOrganizacion', () => {
    const body: AsignarUsuarioOrganizacionBody = {
      email: 'nuevo@duoc.cl',
      rol: 'administrador-patrimonial',
    };

    it('busca el usuario por email en Zitadel y le crea un grant en la organizacion traducida', async () => {
      const { service, zitadelAdminService } = buildService({
        'zitadel-org-1': 'duoc-uc',
      });
      zitadelAdminService.buscarUsuarioPorEmail.mockResolvedValue({
        id: 'usuario-1',
        email: 'nuevo@duoc.cl',
        displayName: 'Nuevo Usuario',
      });
      zitadelAdminService.crearGrant.mockResolvedValue(undefined);

      await service.asignarUsuarioOrganizacion('duoc-uc', body, 'corr-1');

      expect(zitadelAdminService.buscarUsuarioPorEmail).toHaveBeenCalledWith(
        'nuevo@duoc.cl',
        'corr-1',
      );
      expect(zitadelAdminService.crearGrant).toHaveBeenCalledWith(
        'zitadel-org-1',
        'usuario-1',
        'administrador-patrimonial',
        'corr-1',
      );
    });

    it('lanza NotFoundException cuando no existe ningun usuario de Zitadel con ese email', async () => {
      const { service, zitadelAdminService } = buildService({
        'zitadel-org-1': 'duoc-uc',
      });
      zitadelAdminService.buscarUsuarioPorEmail.mockResolvedValue(null);

      await expect(
        service.asignarUsuarioOrganizacion('duoc-uc', body, 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(zitadelAdminService.crearGrant).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException cuando organizacionId no tiene mapeo a un id de Zitadel', async () => {
      const { service, zitadelAdminService } = buildService({});

      await expect(
        service.asignarUsuarioOrganizacion('sin-mapeo', body, 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(zitadelAdminService.buscarUsuarioPorEmail).not.toHaveBeenCalled();
    });
  });

  describe('getContratos', () => {
    it('delega en CoreClientService.getContratos sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService({});
      const pagina = { contratos: [CONTRATO], total: 1 };
      coreClientService.getContratos.mockResolvedValue(pagina);

      await expect(
        service.getContratos({ limit: 20, offset: 0 }, 'corr-1'),
      ).resolves.toEqual(pagina);
      expect(coreClientService.getContratos).toHaveBeenCalledWith(
        { limit: 20, offset: 0 },
        'corr-1',
      );
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
      const pagina = { entradas, total: entradas.length };
      coreClientService.getAuditoria.mockResolvedValue(pagina);
      const filtro = { usuario: 'op-1', operacion: 'baja' };

      await expect(service.getAuditoria(filtro, 'corr-1')).resolves.toEqual(
        pagina,
      );
      expect(coreClientService.getAuditoria).toHaveBeenCalledWith(
        filtro,
        'corr-1',
      );
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
      const pagina = { areas: [AREA], total: 1 };
      coreClientService.getAreas.mockResolvedValue(pagina);

      await expect(
        service.getAreas('duoc-uc', { limit: 20, offset: 0 }, 'corr-1'),
      ).resolves.toEqual(pagina);
      expect(coreClientService.getAreas).toHaveBeenCalledWith(
        'duoc-uc',
        { limit: 20, offset: 0 },
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

  describe('actualizarArea', () => {
    const body: ActualizarAreaBody = {
      organizacionId: 'duoc-uc',
      nombre: 'Biblioteca Central',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const actualizada = { ...AREA, nombre: 'Biblioteca Central' };
      coreClientService.patchArea.mockResolvedValue(actualizada);

      const area = await service.actualizarArea('area-1', body, AUTH, 'corr-1');

      expect(area).toBe(actualizada);
      expect(coreClientService.patchArea).toHaveBeenCalledWith(
        'area-1',
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
      const pagina = { ubicaciones: [UBICACION], total: 1 };
      coreClientService.getUbicaciones.mockResolvedValue(pagina);

      await expect(
        service.getUbicaciones('melipilla', { limit: 20, offset: 0 }, 'corr-1'),
      ).resolves.toEqual(pagina);
      expect(coreClientService.getUbicaciones).toHaveBeenCalledWith(
        'melipilla',
        { limit: 20, offset: 0 },
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

  describe('actualizarUbicacion', () => {
    const body: ActualizarUbicacionBody = {
      organizacionId: 'duoc-uc',
      edificio: 'Torre A',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const actualizada = { ...UBICACION, edificio: 'Torre A' };
      coreClientService.patchUbicacion.mockResolvedValue(actualizada);

      const ubicacion = await service.actualizarUbicacion(
        'ubicacion-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(ubicacion).toBe(actualizada);
      expect(coreClientService.patchUbicacion).toHaveBeenCalledWith(
        'ubicacion-1',
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
      const pagina = { responsables: [RESPONSABLE], total: 1 };
      coreClientService.getResponsables.mockResolvedValue(pagina);

      await expect(
        service.getResponsables('area-1', { limit: 20, offset: 0 }, 'corr-1'),
      ).resolves.toEqual(pagina);
      expect(coreClientService.getResponsables).toHaveBeenCalledWith(
        'area-1',
        { limit: 20, offset: 0 },
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

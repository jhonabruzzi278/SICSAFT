/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { NotFoundException } from '@nestjs/common';
import { AdministradorService } from './administrador.service';
import { CoreClientService } from '../core-client/core-client.service';
import { AuditoriaIdentidadService } from '../auditoria-identidad/auditoria-identidad.service';
import { ZitadelAdminService } from '../zitadel-admin/zitadel-admin.service';
import { OrganizacionMappingDinamicoService } from './organizacion-mapping-dinamico.service';
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
  SedeResult,
  UbicacionResult,
} from '../core-client/core-client.types';
import type {
  ActualizarAreaBody,
  ActualizarContratoBody,
  ActualizarDescripcionActivoBody,
  ActualizarEstadoResponsableBody,
  ActualizarEstadoSedeBody,
  ActualizarUbicacionBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaContratoBody,
  AltaDocumentoActivoBody,
  AltaOrganizacionBody,
  AltaResponsableBody,
  AltaSedeBody,
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
    patchContratoCondiciones: jest.fn(),
    postSede: jest.fn(),
    getSedes: jest.fn(),
    patchSedeEstado: jest.fn(),
    patchOrganizacion: jest.fn(),
    patchOrganizacionEstado: jest.fn(),
    postAuditoria: jest.fn(),
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
    crearOrganizacion: jest.fn(),
    otorgarProyectoAOrganizacion: jest.fn(),
    actualizarNombreOrganizacion: jest.fn(),
    quitarRolDeGrant: jest.fn(),
    desactivarUsuario: jest.fn(),
  } as unknown as jest.Mocked<ZitadelAdminService>;
  const organizacionMappingDinamico = {
    registrar: jest.fn(),
    resolverOrganizacionId: jest.fn(),
    resolverZitadelOrgId: jest.fn(),
  } as unknown as jest.Mocked<OrganizacionMappingDinamicoService>;
  // DOC-024 3 — pass-through por defecto: ejecuta la accion tal cual, sin auditar de verdad, para
  // que los tests de cada metodo puedan seguir verificando solo la llamada a
  // CoreClientService/ZitadelAdminService que les importa. El comportamiento real del wrapper
  // (que SI audita) tiene su propia cobertura en auditoria-identidad.service.spec.ts — acá solo
  // se verifica que cada metodo LO LLAME con el `operacion`/`organizacionId` correctos.
  const auditoriaIdentidad = {
    ejecutar: jest.fn(
      (
        _operacion: string,
        _operadorId: string,
        _correlationId: string,
        accion: () => Promise<unknown>,
      ) => accion(),
    ),
  } as unknown as jest.Mocked<AuditoriaIdentidadService>;
  const service = new AdministradorService(
    coreClientService,
    zitadelAdminService,
    organizacionMappingDinamico,
    auditoriaIdentidad,
    mapping,
  );
  return {
    service,
    coreClientService,
    zitadelAdminService,
    organizacionMappingDinamico,
    auditoriaIdentidad,
  };
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

    it('omite organizaciones sin entrada en NINGUNO de los dos mapeos (nunca inventa una clave)', async () => {
      const { service, coreClientService, organizacionMappingDinamico } =
        buildService({});
      organizacionMappingDinamico.resolverOrganizacionId.mockResolvedValue(
        null,
      );
      coreClientService.postActivo.mockResolvedValue(ACTIVO);

      await service.altaActivo(body, auth, 'corr-1');

      expect(coreClientService.postActivo).toHaveBeenCalledWith(
        expect.objectContaining({ rolesPorOrganizacion: {} }),
        'corr-1',
      );
    });

    it('Gap 0: si el mapeo estatico no tiene la organizacion, prueba el mapeo dinamico antes de omitirla', async () => {
      const { service, coreClientService, organizacionMappingDinamico } =
        buildService({});
      organizacionMappingDinamico.resolverOrganizacionId.mockResolvedValue(
        'org-nueva',
      );
      coreClientService.postActivo.mockResolvedValue(ACTIVO);

      await service.altaActivo(body, auth, 'corr-1');

      expect(
        organizacionMappingDinamico.resolverOrganizacionId,
      ).toHaveBeenCalledWith('386029528616558597');
      expect(coreClientService.postActivo).toHaveBeenCalledWith(
        expect.objectContaining({
          rolesPorOrganizacion: { 'org-nueva': ['administrador-patrimonial'] },
        }),
        'corr-1',
      );
    });

    it('no consulta el mapeo dinamico si el mapeo estatico ya tiene la organizacion (evita un round-trip a Redis innecesario)', async () => {
      const { service, coreClientService, organizacionMappingDinamico } =
        buildService({ '386029528616558597': 'duoc-uc' });
      coreClientService.postActivo.mockResolvedValue(ACTIVO);

      await service.altaActivo(body, auth, 'corr-1');

      expect(
        organizacionMappingDinamico.resolverOrganizacionId,
      ).not.toHaveBeenCalled();
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
    estado: 'activo',
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
    const body: AltaOrganizacionBody = { nombre: 'Nueva Organización' };
    const ORGANIZACION_NUEVA: OrganizacionResult = {
      id: 'zitadel-org-nueva',
      nombre: 'Nueva Organización',
      estado: 'activo',
    };

    // Gap 1 (flujo real Admin->Directivo->Profesional AFT) — ya no recibe el id de Zitadel del
    // cliente: lo crea primero en Zitadel y usa ESE id para escribir en CORE y para registrar el
    // mapeo dinamico (Gap 0), en ese orden.
    it('crea la organizacion en Zitadel, escribe en CORE con el id real, y registra el mapeo dinamico — en ese orden', async () => {
      const {
        service,
        coreClientService,
        zitadelAdminService,
        organizacionMappingDinamico,
      } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      zitadelAdminService.crearOrganizacion.mockResolvedValue({
        id: 'zitadel-org-nueva',
      });
      zitadelAdminService.otorgarProyectoAOrganizacion.mockResolvedValue(
        undefined,
      );
      coreClientService.postOrganizacion.mockResolvedValue(ORGANIZACION_NUEVA);
      organizacionMappingDinamico.registrar.mockResolvedValue(undefined);

      const organizacion = await service.altaOrganizacion(body, AUTH, 'corr-1');

      expect(organizacion).toBe(ORGANIZACION_NUEVA);
      expect(zitadelAdminService.crearOrganizacion).toHaveBeenCalledWith(
        'Nueva Organización',
        'corr-1',
      );
      expect(
        zitadelAdminService.otorgarProyectoAOrganizacion,
      ).toHaveBeenCalledWith('zitadel-org-nueva', 'corr-1');
      expect(coreClientService.postOrganizacion).toHaveBeenCalledWith(
        {
          id: 'zitadel-org-nueva',
          nombre: 'Nueva Organización',
          correlationId: 'corr-1',
          operadorId: 'op-1',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        },
        'corr-1',
      );
      expect(organizacionMappingDinamico.registrar).toHaveBeenCalledWith(
        'zitadel-org-nueva',
        'zitadel-org-nueva',
      );
      // Orden: crear org -> otorgar ProjectGrant -> CORE -> mapeo dinamico (ver comentario en
      // altaOrganizacion: una organizacion sin ProjectGrant es inutil, mejor fallar antes de
      // registrarla en CORE que dejarla creada pero inoperable).
      const ordenZitadel =
        zitadelAdminService.crearOrganizacion.mock.invocationCallOrder[0];
      const ordenProjectGrant =
        zitadelAdminService.otorgarProyectoAOrganizacion.mock
          .invocationCallOrder[0];
      const ordenCore =
        coreClientService.postOrganizacion.mock.invocationCallOrder[0];
      const ordenRegistro =
        organizacionMappingDinamico.registrar.mock.invocationCallOrder[0];
      expect(ordenZitadel).toBeLessThan(ordenProjectGrant);
      expect(ordenProjectGrant).toBeLessThan(ordenCore);
      expect(ordenCore).toBeLessThan(ordenRegistro);
    });

    it('si Zitadel falla al crear la organizacion, nunca otorga el ProjectGrant ni llama a CORE', async () => {
      const {
        service,
        coreClientService,
        zitadelAdminService,
        organizacionMappingDinamico,
      } = buildService({});
      zitadelAdminService.crearOrganizacion.mockRejectedValue(
        new Error('Zitadel no disponible'),
      );

      await expect(
        service.altaOrganizacion(body, AUTH, 'corr-1'),
      ).rejects.toThrow('Zitadel no disponible');
      expect(
        zitadelAdminService.otorgarProyectoAOrganizacion,
      ).not.toHaveBeenCalled();
      expect(coreClientService.postOrganizacion).not.toHaveBeenCalled();
      expect(organizacionMappingDinamico.registrar).not.toHaveBeenCalled();
    });

    // Gap 1 — hallazgo real: sin el ProjectGrant, la organizacion queda inutil (nadie puede
    // recibir un rol ahi). Mejor fallar antes de registrarla en CORE.
    it('si falla el ProjectGrant, nunca llama a CORE ni registra el mapeo', async () => {
      const {
        service,
        coreClientService,
        zitadelAdminService,
        organizacionMappingDinamico,
      } = buildService({});
      zitadelAdminService.crearOrganizacion.mockResolvedValue({
        id: 'zitadel-org-nueva',
      });
      zitadelAdminService.otorgarProyectoAOrganizacion.mockRejectedValue(
        new Error('Zitadel no disponible'),
      );

      await expect(
        service.altaOrganizacion(body, AUTH, 'corr-1'),
      ).rejects.toThrow('Zitadel no disponible');
      expect(coreClientService.postOrganizacion).not.toHaveBeenCalled();
      expect(organizacionMappingDinamico.registrar).not.toHaveBeenCalled();
    });

    it('si CORE falla despues de crear en Zitadel, no registra el mapeo dinamico', async () => {
      const {
        service,
        coreClientService,
        zitadelAdminService,
        organizacionMappingDinamico,
      } = buildService({});
      zitadelAdminService.crearOrganizacion.mockResolvedValue({
        id: 'zitadel-org-nueva',
      });
      zitadelAdminService.otorgarProyectoAOrganizacion.mockResolvedValue(
        undefined,
      );
      coreClientService.postOrganizacion.mockRejectedValue(
        new Error('CORE no disponible'),
      );

      await expect(
        service.altaOrganizacion(body, AUTH, 'corr-1'),
      ).rejects.toThrow('CORE no disponible');
      expect(organizacionMappingDinamico.registrar).not.toHaveBeenCalled();
    });
  });

  describe('editarOrganizacion', () => {
    it('actualiza el nombre en Zitadel primero, despues en CORE (mismo orden que altaOrganizacion)', async () => {
      const { service, coreClientService, zitadelAdminService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const renombrada: OrganizacionResult = {
        id: 'duoc-uc',
        nombre: 'DUOC UC (renombrada)',
        estado: 'activo',
      };
      zitadelAdminService.actualizarNombreOrganizacion.mockResolvedValue(
        undefined,
      );
      coreClientService.patchOrganizacion.mockResolvedValue(renombrada);

      const organizacion = await service.editarOrganizacion(
        'duoc-uc',
        { nombre: 'DUOC UC (renombrada)' },
        AUTH,
        'corr-1',
      );

      expect(organizacion).toBe(renombrada);
      expect(
        zitadelAdminService.actualizarNombreOrganizacion,
      ).toHaveBeenCalledWith(
        '386029528616558597',
        'DUOC UC (renombrada)',
        'corr-1',
      );
      expect(coreClientService.patchOrganizacion).toHaveBeenCalledWith(
        'duoc-uc',
        {
          nombre: 'DUOC UC (renombrada)',
          correlationId: 'corr-1',
          operadorId: 'op-1',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        },
        'corr-1',
      );
      const ordenZitadel =
        zitadelAdminService.actualizarNombreOrganizacion.mock
          .invocationCallOrder[0];
      const ordenCore =
        coreClientService.patchOrganizacion.mock.invocationCallOrder[0];
      expect(ordenZitadel).toBeLessThan(ordenCore);
    });

    it('si Zitadel falla, nunca llama a CORE', async () => {
      const { service, coreClientService, zitadelAdminService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      zitadelAdminService.actualizarNombreOrganizacion.mockRejectedValue(
        new Error('Zitadel no disponible'),
      );

      await expect(
        service.editarOrganizacion(
          'duoc-uc',
          { nombre: 'Nombre nuevo' },
          AUTH,
          'corr-1',
        ),
      ).rejects.toThrow('Zitadel no disponible');
      expect(coreClientService.patchOrganizacion).not.toHaveBeenCalled();
    });
  });

  describe('actualizarEstadoOrganizacion', () => {
    it('delega en CoreClientService.patchOrganizacionEstado sin tocar Zitadel — sin cascada (DOC-024 1)', async () => {
      const { service, coreClientService, zitadelAdminService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const inactiva: OrganizacionResult = {
        id: 'duoc-uc',
        nombre: 'DUOC UC',
        estado: 'inactivo',
      };
      coreClientService.patchOrganizacionEstado.mockResolvedValue(inactiva);

      const organizacion = await service.actualizarEstadoOrganizacion(
        'duoc-uc',
        { estado: 'inactivo' },
        AUTH,
        'corr-1',
      );

      expect(organizacion).toBe(inactiva);
      expect(coreClientService.patchOrganizacionEstado).toHaveBeenCalledWith(
        'duoc-uc',
        {
          estado: 'inactivo',
          correlationId: 'corr-1',
          operadorId: 'op-1',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        },
        'corr-1',
      );
      expect(
        zitadelAdminService.actualizarNombreOrganizacion,
      ).not.toHaveBeenCalled();
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

    it('lanza NotFoundException cuando organizacionId no tiene mapeo a un id de Zitadel (ni estatico ni dinamico)', async () => {
      const { service, organizacionMappingDinamico } = buildService({});
      organizacionMappingDinamico.resolverZitadelOrgId.mockResolvedValue(null);

      await expect(
        service.listarUsuariosOrganizacion('sin-mapeo', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('Gap 0: si el mapeo estatico no tiene la organizacion, prueba el mapeo dinamico (organizacion creada via altaOrganizacion)', async () => {
      const { service, zitadelAdminService, organizacionMappingDinamico } =
        buildService({});
      organizacionMappingDinamico.resolverZitadelOrgId.mockResolvedValue(
        'zitadel-org-nueva',
      );
      zitadelAdminService.listarGrants.mockResolvedValue([]);

      await service.listarUsuariosOrganizacion('org-nueva', 'corr-1');

      expect(
        organizacionMappingDinamico.resolverZitadelOrgId,
      ).toHaveBeenCalledWith('org-nueva');
      expect(zitadelAdminService.listarGrants).toHaveBeenCalledWith(
        'zitadel-org-nueva',
        'corr-1',
      );
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

      await service.asignarUsuarioOrganizacion('duoc-uc', body, AUTH, 'corr-1');

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
        service.asignarUsuarioOrganizacion('duoc-uc', body, AUTH, 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(zitadelAdminService.crearGrant).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException cuando organizacionId no tiene mapeo a un id de Zitadel', async () => {
      const { service, zitadelAdminService } = buildService({});

      await expect(
        service.asignarUsuarioOrganizacion('sin-mapeo', body, AUTH, 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(zitadelAdminService.buscarUsuarioPorEmail).not.toHaveBeenCalled();
    });

    // DOC-024 3 — esta operacion nunca toca CORE, asi que sin este wrapper quedaba fuera del
    // Motor de Auditoria por completo.
    it('envuelve la operacion en AuditoriaIdentidadService.ejecutar con el operador y la organizacion (DOC-024 3)', async () => {
      const { service, zitadelAdminService, auditoriaIdentidad } = buildService(
        { 'zitadel-org-1': 'duoc-uc' },
      );
      zitadelAdminService.buscarUsuarioPorEmail.mockResolvedValue({
        id: 'usuario-1',
        email: 'nuevo@duoc.cl',
        displayName: 'Nuevo Usuario',
      });

      await service.asignarUsuarioOrganizacion('duoc-uc', body, AUTH, 'corr-1');

      expect(auditoriaIdentidad.ejecutar).toHaveBeenCalledWith(
        'POST /admin/organizaciones/duoc-uc/usuarios',
        'op-1',
        'corr-1',
        expect.any(Function),
        { organizacionId: 'duoc-uc' },
      );
    });
  });

  describe('quitarRolUsuarioOrganizacion', () => {
    it('resuelve el id de Zitadel y quita el rol via ZitadelAdminService', async () => {
      const { service, zitadelAdminService, auditoriaIdentidad } = buildService(
        { 'zitadel-org-1': 'duoc-uc' },
      );
      zitadelAdminService.quitarRolDeGrant.mockResolvedValue(undefined);

      await service.quitarRolUsuarioOrganizacion(
        'duoc-uc',
        'usuario-1',
        { rol: 'directivo' },
        AUTH,
        'corr-1',
      );

      expect(zitadelAdminService.quitarRolDeGrant).toHaveBeenCalledWith(
        'zitadel-org-1',
        'usuario-1',
        'directivo',
        'corr-1',
      );
      expect(auditoriaIdentidad.ejecutar).toHaveBeenCalledWith(
        'DELETE /admin/organizaciones/duoc-uc/usuarios/usuario-1',
        'op-1',
        'corr-1',
        expect.any(Function),
        { organizacionId: 'duoc-uc' },
      );
    });
  });

  describe('desactivarUsuarioOrganizacion', () => {
    it('resuelve el id de Zitadel y desactiva al usuario via ZitadelAdminService', async () => {
      const { service, zitadelAdminService, auditoriaIdentidad } = buildService(
        { 'zitadel-org-1': 'duoc-uc' },
      );
      zitadelAdminService.desactivarUsuario.mockResolvedValue(undefined);

      await service.desactivarUsuarioOrganizacion(
        'duoc-uc',
        'usuario-1',
        AUTH,
        'corr-1',
      );

      expect(zitadelAdminService.desactivarUsuario).toHaveBeenCalledWith(
        'zitadel-org-1',
        'usuario-1',
        'corr-1',
      );
      expect(auditoriaIdentidad.ejecutar).toHaveBeenCalledWith(
        'POST /admin/organizaciones/duoc-uc/usuarios/usuario-1/desactivar',
        'op-1',
        'corr-1',
        expect.any(Function),
        { organizacionId: 'duoc-uc' },
      );
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

  describe('actualizarCondicionesContrato', () => {
    it('delega en CoreClientService.patchContratoCondiciones (DOC-024 2)', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const actualizado = {
        ...CONTRATO,
        vigenciaHasta: '2027-01-01T00:00:00.000Z',
      };
      coreClientService.patchContratoCondiciones.mockResolvedValue(actualizado);
      const body = {
        organizacionId: 'duoc-uc',
        vigenciaHasta: '2027-01-01T00:00:00.000Z',
      };

      const contrato = await service.actualizarCondicionesContrato(
        'contrato-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(contrato).toBe(actualizado);
      expect(coreClientService.patchContratoCondiciones).toHaveBeenCalledWith(
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

  describe('altaSede', () => {
    const body: AltaSedeBody = {
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
    };
    const SEDE: SedeResult = {
      id: 'sede-1',
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
      estado: 'activo',
    };

    it('traduce rolesPorOrganizacion de Zitadel a organizacionId de CORE antes de llamar a CoreClientService', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      coreClientService.postSede.mockResolvedValue(SEDE);

      const sede = await service.altaSede(body, AUTH, 'corr-1');

      expect(sede).toBe(SEDE);
      expect(coreClientService.postSede).toHaveBeenCalledWith(
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

  describe('getSedes', () => {
    it('delega en CoreClientService.getSedes (DOC-024 1)', async () => {
      const { service, coreClientService } = buildService({});
      const sedes: SedeResult[] = [
        {
          id: 'sede-1',
          organizacionId: 'duoc-uc',
          nombre: 'Melipilla',
          estado: 'activo',
        },
      ];
      coreClientService.getSedes.mockResolvedValue(sedes);

      await expect(service.getSedes('duoc-uc', 'corr-1')).resolves.toBe(sedes);
      expect(coreClientService.getSedes).toHaveBeenCalledWith(
        'duoc-uc',
        'corr-1',
      );
    });
  });

  describe('actualizarEstadoSede', () => {
    it('delega en CoreClientService.patchSedeEstado — sin cascada a Contrato (DOC-024 1)', async () => {
      const { service, coreClientService } = buildService({
        '386029528616558597': 'duoc-uc',
      });
      const inactiva: SedeResult = {
        id: 'sede-1',
        organizacionId: 'duoc-uc',
        nombre: 'Melipilla',
        estado: 'inactivo',
      };
      coreClientService.patchSedeEstado.mockResolvedValue(inactiva);
      const body: ActualizarEstadoSedeBody = {
        organizacionId: 'duoc-uc',
        estado: 'inactivo',
      };

      const sede = await service.actualizarEstadoSede(
        'sede-1',
        body,
        AUTH,
        'corr-1',
      );

      expect(sede).toBe(inactiva);
      expect(coreClientService.patchSedeEstado).toHaveBeenCalledWith(
        'sede-1',
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

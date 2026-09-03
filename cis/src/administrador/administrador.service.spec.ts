/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { AdministradorService } from './administrador.service';
import { CoreClientService } from '../core-client/core-client.service';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';
import type {
  ActivoResult,
  AreaResult,
  AuditoriaEntradaResult,
  CatalogoTipoResult,
  DocumentoActivoResult,
  ImportacionContableResult,
  ResponsableResult,
  UbicacionResult,
} from '../core-client/core-client.types';
import type {
  ActualizarAreaBody,
  ActualizarDescripcionActivoBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaDocumentoActivoBody,
  AltaResponsableBody,
  AltaUbicacionBody,
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

// AdministradorService no traduce nada — solo pasa `auth.rolesPorOrganizacion` tal cual a
// CoreClientService (ADR-004).
function buildService() {
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
    postLoteImportacionContable: jest.fn(),
    getLotesImportacionContable: jest.fn(),
    getLoteImportacionContable: jest.fn(),
    postAprobarLoteImportacionContable: jest.fn(),
    postRechazarLoteImportacionContable: jest.fn(),
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
  const service = new AdministradorService(coreClientService);
  return { service, coreClientService };
}

const AUTH: KeycloakAuthContext = {
  operadorId: 'op-1',
  accessToken: 'token-1',
  expiresAt: '2026-01-01T00:00:00.000Z',
  rolesPorOrganizacion: {
    'duoc-uc': ['administrador-patrimonial'],
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService (sin traduccion, ADR-004)', async () => {
      const { service, coreClientService } = buildService();
      coreClientService.postActivo.mockResolvedValue(ACTIVO);

      const activo = await service.altaActivo(body, AUTH, 'corr-1');

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
  });

  describe('bajaActivo', () => {
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

  // DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada.
  describe('bandeja de staging de importación contable', () => {
    const identidad = {
      correlationId: 'corr-1',
      operadorId: 'op-1',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    };

    it('crearLoteImportacionContable inyecta la identidad del JWT', async () => {
      const { service, coreClientService } = buildService();
      coreClientService.postLoteImportacionContable.mockResolvedValue({
        loteId: 'lote-1',
        resumen: { totalFilas: 1, crear: 1, yaImportado: 0, conflicto: 0 },
      });
      const body = {
        organizacionId: 'duoc-uc',
        origen: 'carpeta' as const,
        archivoNombre: 'activos.xls',
        filas: [
          {
            linea: 1,
            codigoPatrimonial: 'DG-001',
            codigoQr: 'DG-001',
            catalogoId: 'cat-1',
            crudo: {},
          },
        ],
      };

      await service.crearLoteImportacionContable(body, AUTH, 'corr-1');

      expect(
        coreClientService.postLoteImportacionContable,
      ).toHaveBeenCalledWith({ ...body, ...identidad }, 'corr-1');
    });

    it('listarLotesImportacionContable es passthrough', async () => {
      const { service, coreClientService } = buildService();
      coreClientService.getLotesImportacionContable.mockResolvedValue([]);

      await service.listarLotesImportacionContable(
        'duoc-uc',
        'aprobado',
        'corr-1',
      );

      expect(
        coreClientService.getLotesImportacionContable,
      ).toHaveBeenCalledWith('duoc-uc', 'aprobado', 'corr-1');
    });

    it('obtenerLoteImportacionContable es passthrough', async () => {
      const { service, coreClientService } = buildService();
      coreClientService.getLoteImportacionContable.mockResolvedValue({
        lote: {} as never,
        filas: [],
      });

      await service.obtenerLoteImportacionContable('lote-1', 'corr-1');

      expect(coreClientService.getLoteImportacionContable).toHaveBeenCalledWith(
        'lote-1',
        'corr-1',
      );
    });

    it('aprobarLoteImportacionContable inyecta la identidad del JWT', async () => {
      const { service, coreClientService } = buildService();
      coreClientService.postAprobarLoteImportacionContable.mockResolvedValue({
        filas: [],
        creados: 1,
        yaImportados: 0,
        conflictos: 0,
      });

      await service.aprobarLoteImportacionContable(
        'lote-1',
        { organizacionId: 'duoc-uc' },
        AUTH,
        'corr-1',
      );

      expect(
        coreClientService.postAprobarLoteImportacionContable,
      ).toHaveBeenCalledWith(
        'lote-1',
        { organizacionId: 'duoc-uc', ...identidad },
        'corr-1',
      );
    });

    it('rechazarLoteImportacionContable inyecta la identidad del JWT', async () => {
      const { service, coreClientService } = buildService();
      coreClientService.postRechazarLoteImportacionContable.mockResolvedValue({
        estado: 'rechazado',
      });

      await service.rechazarLoteImportacionContable(
        'lote-1',
        { organizacionId: 'duoc-uc', motivo: 'no cuadra' },
        AUTH,
        'corr-1',
      );

      expect(
        coreClientService.postRechazarLoteImportacionContable,
      ).toHaveBeenCalledWith(
        'lote-1',
        { organizacionId: 'duoc-uc', motivo: 'no cuadra', ...identidad },
        'corr-1',
      );
    });
  });

  describe('getAuditoria', () => {
    it('delega en CoreClientService.getAuditoria sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService();
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
          areaOperativa: 'area-biblioteca',
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
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

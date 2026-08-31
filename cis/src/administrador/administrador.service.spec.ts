/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { NotFoundException } from '@nestjs/common';
import { AdministradorService } from './administrador.service';
import { CoreClientService } from '../core-client/core-client.service';
import { AuditoriaIdentidadService } from '../auditoria-identidad/auditoria-identidad.service';
import { KeycloakAdminService } from '../keycloak-admin/keycloak-admin.service';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';
import type { GrantUsuario } from '../keycloak-admin/keycloak-admin.types';
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

// ADR-004 — buildService ya no recibe un mapa de organizacionId->id-de-Zitadel: con Keycloak,
// rolesPorOrganizacion viene keyed por el mismo organizacionId que usa CORE (el alias de la
// Organization), así que AdministradorService no traduce nada — solo pasa `auth.rolesPorOrganizacion`
// tal cual a CoreClientService.
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
  const keycloakAdminService = {
    buscarUsuarioPorEmail: jest.fn(),
    listarGrants: jest.fn(),
    crearGrant: jest.fn(),
    crearOrganizacion: jest.fn(),
    actualizarNombreOrganizacion: jest.fn(),
    quitarRolDeGrant: jest.fn(),
    desactivarUsuario: jest.fn(),
  } as unknown as jest.Mocked<KeycloakAdminService>;
  // DOC-024 3 — pass-through por defecto: ejecuta la accion tal cual, sin auditar de verdad, para
  // que los tests de cada metodo puedan seguir verificando solo la llamada a
  // CoreClientService/KeycloakAdminService que les importa. El comportamiento real del wrapper
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
    keycloakAdminService,
    auditoriaIdentidad,
  );
  return {
    service,
    coreClientService,
    keycloakAdminService,
    auditoriaIdentidad,
  };
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

  const ORGANIZACION: OrganizacionResult = {
    id: 'duoc-uc',
    nombre: 'DUOC UC',
    estado: 'activo',
  };

  describe('getOrganizaciones', () => {
    it('delega en CoreClientService.getOrganizaciones sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService();
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
      id: 'nueva-organizacion',
      nombre: 'Nueva Organización',
      estado: 'activo',
    };

    // ADR-004 — ya no hay paso de ProjectGrant (concepto propio de Zitadel) ni registro de mapeo
    // dinámico: KeycloakAdminService.crearOrganizacion decide el organizacionId (alias) y CORE usa
    // ese mismo id directo.
    it('crea la organizacion en Keycloak y escribe en CORE con el id que devuelve, en ese orden', async () => {
      const { service, coreClientService, keycloakAdminService } =
        buildService();
      keycloakAdminService.crearOrganizacion.mockResolvedValue({
        id: 'nueva-organizacion',
      });
      coreClientService.postOrganizacion.mockResolvedValue(ORGANIZACION_NUEVA);

      const organizacion = await service.altaOrganizacion(body, AUTH, 'corr-1');

      expect(organizacion).toBe(ORGANIZACION_NUEVA);
      expect(keycloakAdminService.crearOrganizacion).toHaveBeenCalledWith(
        'Nueva Organización',
        'corr-1',
      );
      expect(coreClientService.postOrganizacion).toHaveBeenCalledWith(
        {
          id: 'nueva-organizacion',
          nombre: 'Nueva Organización',
          correlationId: 'corr-1',
          operadorId: 'op-1',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        },
        'corr-1',
      );
      const ordenKeycloak =
        keycloakAdminService.crearOrganizacion.mock.invocationCallOrder[0];
      const ordenCore =
        coreClientService.postOrganizacion.mock.invocationCallOrder[0];
      expect(ordenKeycloak).toBeLessThan(ordenCore);
    });

    it('si Keycloak falla al crear la organizacion, nunca llama a CORE', async () => {
      const { service, coreClientService, keycloakAdminService } =
        buildService();
      keycloakAdminService.crearOrganizacion.mockRejectedValue(
        new Error('Keycloak no disponible'),
      );

      await expect(
        service.altaOrganizacion(body, AUTH, 'corr-1'),
      ).rejects.toThrow('Keycloak no disponible');
      expect(coreClientService.postOrganizacion).not.toHaveBeenCalled();
    });
  });

  describe('editarOrganizacion', () => {
    it('actualiza el nombre en Keycloak primero, despues en CORE (mismo orden que altaOrganizacion)', async () => {
      const { service, coreClientService, keycloakAdminService } =
        buildService();
      const renombrada: OrganizacionResult = {
        id: 'duoc-uc',
        nombre: 'DUOC UC (renombrada)',
        estado: 'activo',
      };
      keycloakAdminService.actualizarNombreOrganizacion.mockResolvedValue(
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
        keycloakAdminService.actualizarNombreOrganizacion,
      ).toHaveBeenCalledWith('duoc-uc', 'DUOC UC (renombrada)', 'corr-1');
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
      const ordenKeycloak =
        keycloakAdminService.actualizarNombreOrganizacion.mock
          .invocationCallOrder[0];
      const ordenCore =
        coreClientService.patchOrganizacion.mock.invocationCallOrder[0];
      expect(ordenKeycloak).toBeLessThan(ordenCore);
    });

    it('si Keycloak falla, nunca llama a CORE', async () => {
      const { service, coreClientService, keycloakAdminService } =
        buildService();
      keycloakAdminService.actualizarNombreOrganizacion.mockRejectedValue(
        new Error('Keycloak no disponible'),
      );

      await expect(
        service.editarOrganizacion(
          'duoc-uc',
          { nombre: 'Nombre nuevo' },
          AUTH,
          'corr-1',
        ),
      ).rejects.toThrow('Keycloak no disponible');
      expect(coreClientService.patchOrganizacion).not.toHaveBeenCalled();
    });
  });

  describe('actualizarEstadoOrganizacion', () => {
    it('delega en CoreClientService.patchOrganizacionEstado sin tocar Keycloak — sin cascada (DOC-024 1)', async () => {
      const { service, coreClientService, keycloakAdminService } =
        buildService();
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
        keycloakAdminService.actualizarNombreOrganizacion,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getIndicadores', () => {
    it('delega en CoreClientService.getIndicadores sin traducir roles (lectura abierta)', async () => {
      const { service, coreClientService } = buildService();
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
    it('delega en KeycloakAdminService.listarGrants con el organizacionId recibido (sin traduccion, ADR-004)', async () => {
      const { service, keycloakAdminService } = buildService();
      const grants: GrantUsuario[] = [
        {
          userId: 'usuario-1',
          email: 'usuario@duoc.cl',
          displayName: 'Usuario Uno',
          roles: ['administrador-patrimonial'],
        },
      ];
      keycloakAdminService.listarGrants.mockResolvedValue(grants);

      await expect(
        service.listarUsuariosOrganizacion('duoc-uc', 'corr-1'),
      ).resolves.toEqual(grants);
      expect(keycloakAdminService.listarGrants).toHaveBeenCalledWith(
        'duoc-uc',
        'corr-1',
      );
    });
  });

  describe('asignarUsuarioOrganizacion', () => {
    const body: AsignarUsuarioOrganizacionBody = {
      email: 'nuevo@duoc.cl',
      rol: 'administrador-patrimonial',
    };

    it('busca el usuario por email en Keycloak y le crea un grant en la organizacion recibida', async () => {
      const { service, keycloakAdminService } = buildService();
      keycloakAdminService.buscarUsuarioPorEmail.mockResolvedValue({
        id: 'usuario-1',
        email: 'nuevo@duoc.cl',
        displayName: 'Nuevo Usuario',
      });
      keycloakAdminService.crearGrant.mockResolvedValue(undefined);

      await service.asignarUsuarioOrganizacion('duoc-uc', body, AUTH, 'corr-1');

      expect(keycloakAdminService.buscarUsuarioPorEmail).toHaveBeenCalledWith(
        'nuevo@duoc.cl',
        'corr-1',
      );
      expect(keycloakAdminService.crearGrant).toHaveBeenCalledWith(
        'duoc-uc',
        'usuario-1',
        'administrador-patrimonial',
        'corr-1',
      );
    });

    it('lanza NotFoundException cuando no existe ningun usuario de Keycloak con ese email', async () => {
      const { service, keycloakAdminService } = buildService();
      keycloakAdminService.buscarUsuarioPorEmail.mockResolvedValue(null);

      await expect(
        service.asignarUsuarioOrganizacion('duoc-uc', body, AUTH, 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(keycloakAdminService.crearGrant).not.toHaveBeenCalled();
    });

    // DOC-024 3 — esta operacion nunca toca CORE, asi que sin este wrapper quedaba fuera del
    // Motor de Auditoria por completo.
    it('envuelve la operacion en AuditoriaIdentidadService.ejecutar con el operador y la organizacion (DOC-024 3)', async () => {
      const { service, keycloakAdminService, auditoriaIdentidad } =
        buildService();
      keycloakAdminService.buscarUsuarioPorEmail.mockResolvedValue({
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
    it('quita el rol via KeycloakAdminService (sin traduccion, ADR-004)', async () => {
      const { service, keycloakAdminService, auditoriaIdentidad } =
        buildService();
      keycloakAdminService.quitarRolDeGrant.mockResolvedValue(undefined);

      await service.quitarRolUsuarioOrganizacion(
        'duoc-uc',
        'usuario-1',
        { rol: 'directivo' },
        AUTH,
        'corr-1',
      );

      expect(keycloakAdminService.quitarRolDeGrant).toHaveBeenCalledWith(
        'duoc-uc',
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
    // ADR-004 — deshabilitar una cuenta de Keycloak es global (no scoped a una organización, a
    // diferencia del estado "initial" de Zitadel) — desactivarUsuario ya no recibe organizacionId.
    it('desactiva al usuario via KeycloakAdminService', async () => {
      const { service, keycloakAdminService, auditoriaIdentidad } =
        buildService();
      keycloakAdminService.desactivarUsuario.mockResolvedValue(undefined);

      await service.desactivarUsuarioOrganizacion(
        'duoc-uc',
        'usuario-1',
        AUTH,
        'corr-1',
      );

      expect(keycloakAdminService.desactivarUsuario).toHaveBeenCalledWith(
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
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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
      const { service, coreClientService } = buildService();
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

    it('pasa rolesPorOrganizacion tal cual a CoreClientService', async () => {
      const { service, coreClientService } = buildService();
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
      const { service, coreClientService } = buildService();
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
      const { service, coreClientService } = buildService();
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

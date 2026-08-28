import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { generateKeyPair, type JWTVerifyGetKey } from 'jose';
import type {
  ActivoResult,
  CatalogoTipoResult,
  DocumentoActivoResult,
  ImportacionContableResult,
  IndicadoresResult,
  OrganizacionResult,
} from './../src/core-client/core-client.types';
import type { GrantUsuario } from './../src/keycloak-admin/keycloak-admin.types';
import { crearAppE2e } from './support/e2e-app';
import { firmarTokenKeycloak } from './support/jwt';

const ISSUER = 'http://id.sicsaft.localhost/realms/sicsaft';
const AUDIENCE = 'cis-api';
// ADR-004 — `organizacionId` ya es el alias de la Organization de Keycloak, sin traducción
// numérica (ver el comentario equivalente en administrador.e2e-spec.ts).
const ORGANIZACION_ID = 'duoc-uc';

const ACTIVO_STUB: ActivoResult = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-1',
  codigoQr: 'QR-1',
  organizacionId: 'duoc-uc',
  areaId: null,
  ubicacionId: null,
  responsableId: null,
  estado: 'activo',
  descripcion: 'Con rayón en la tapa',
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
  },
};

const CATALOGO_TIPO_STUB: CatalogoTipoResult = {
  id: 'catalogo-silla',
  tipo: 'Silla',
  familia: 'Mobiliario',
  subfamilia: null,
  marca: null,
  modelo: null,
  fabricante: null,
  vidaUtilMeses: null,
  criticidad: 'baja',
  tecnologiaIdentificacion: 'qr',
};

const DOCUMENTO_STUB: DocumentoActivoResult = {
  id: 'documento-1',
  activoId: 'activo-1',
  organizacionId: 'duoc-uc',
  tipo: 'fotografia',
  url: 'https://ejemplo.org/foto.jpg',
  descripcion: null,
  creadoEn: '2026-08-18T10:00:00.000Z',
  creadoPor: 'op-admin',
};

const ORGANIZACION_STUB: OrganizacionResult = {
  id: ORGANIZACION_ID,
  nombre: 'DUOC UC',
  estado: 'activo',
};

const INDICADORES_STUB: IndicadoresResult = {
  totalOrganizaciones: 1,
  totalSedes: 1,
  contratosPorEstado: { vigente: 1, suspendido: 0, vencido: 0, cancelado: 0 },
};

const IMPORTACION_STUB: ImportacionContableResult = {
  filas: [{ codigoPatrimonial: 'AFT-1', resultado: 'creado' }],
  creados: 1,
  yaImportados: 0,
  conflictos: 0,
};

describe('DOC-021 — cierre de gaps del CCP + Administrador del Sistema (CIS e2e)', () => {
  let app: INestApplication<App>;
  let tokenPatrimonial: string;
  let tokenSistema: string;
  let coreClientService: {
    postActivoBaja: jest.Mock;
    postActivoReincorporacion: jest.Mock;
    patchActivoResponsable: jest.Mock;
    patchActivoDescripcion: jest.Mock;
    getCatalogoTipos: jest.Mock;
    postCatalogoTipo: jest.Mock;
    getDocumentosActivo: jest.Mock;
    postDocumentoActivo: jest.Mock;
    deleteDocumentoActivo: jest.Mock;
    getOrganizaciones: jest.Mock;
    postOrganizacion: jest.Mock;
    getIndicadores: jest.Mock;
    postImportacionContable: jest.Mock;
  };
  let keycloakAdminService: {
    buscarUsuarioPorEmail: jest.Mock;
    listarGrants: jest.Mock;
    crearGrant: jest.Mock;
    crearOrganizacion: jest.Mock;
    resolverRolesPorOrganizacionDeUsuario: jest.Mock;
  };

  beforeEach(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    // ADR-004 — sujetos distintos por persona (mismo criterio que directivo.e2e-spec.ts):
    // KeycloakAuthGuard cachea rolesPorOrganizacion por `sub`, y el rol lo resuelve el servidor a
    // partir del usuario, no del JWT presentado.
    tokenPatrimonial = await firmarTokenKeycloak(
      privateKey,
      [ORGANIZACION_ID],
      {
        issuer: ISSUER,
        audience: AUDIENCE,
        subject: 'op-patrimonial',
      },
    );
    tokenSistema = await firmarTokenKeycloak(privateKey, [ORGANIZACION_ID], {
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: 'op-sistema',
    });
    const localJwks: JWTVerifyGetKey = () => Promise.resolve(publicKey);

    const ROLES_POR_OPERADOR: Record<string, Record<string, string[]>> = {
      'op-patrimonial': { [ORGANIZACION_ID]: ['administrador-patrimonial'] },
      'op-sistema': { [ORGANIZACION_ID]: ['administrador-sistema'] },
    };

    coreClientService = {
      postActivoBaja: jest.fn().mockResolvedValue({
        ...ACTIVO_STUB,
        estado: 'dado_de_baja',
      }),
      postActivoReincorporacion: jest.fn().mockResolvedValue(ACTIVO_STUB),
      patchActivoResponsable: jest.fn().mockResolvedValue(ACTIVO_STUB),
      patchActivoDescripcion: jest.fn().mockResolvedValue(ACTIVO_STUB),
      getCatalogoTipos: jest.fn().mockResolvedValue([CATALOGO_TIPO_STUB]),
      postCatalogoTipo: jest.fn().mockResolvedValue(CATALOGO_TIPO_STUB),
      getDocumentosActivo: jest.fn().mockResolvedValue([DOCUMENTO_STUB]),
      postDocumentoActivo: jest.fn().mockResolvedValue(DOCUMENTO_STUB),
      deleteDocumentoActivo: jest.fn().mockResolvedValue(undefined),
      getOrganizaciones: jest.fn().mockResolvedValue([ORGANIZACION_STUB]),
      postOrganizacion: jest.fn().mockResolvedValue(ORGANIZACION_STUB),
      getIndicadores: jest.fn().mockResolvedValue(INDICADORES_STUB),
      postImportacionContable: jest.fn().mockResolvedValue(IMPORTACION_STUB),
      // DOC-024 3 — AdministradorService ahora envuelve asignarUsuarioOrganizacion en
      // AuditoriaIdentidadService, que reporta el resultado via CoreClientService.postAuditoria.
      postAuditoria: jest.fn().mockResolvedValue(undefined),
    };
    keycloakAdminService = {
      buscarUsuarioPorEmail: jest.fn().mockResolvedValue({
        id: 'usuario-keycloak-1',
        email: null,
        displayName: null,
      }),
      listarGrants: jest.fn().mockResolvedValue([
        {
          userId: 'usuario-keycloak-1',
          email: 'a@duoc.cl',
          displayName: null,
          roles: ['administrador-patrimonial'],
        },
      ] satisfies GrantUsuario[]),
      crearGrant: jest.fn().mockResolvedValue(undefined),
      // Gap 1 (flujo real Admin->Directivo->Profesional AFT) — usado por
      // AdministradorService.altaOrganizacion (ver el describe de organizaciones mas abajo).
      crearOrganizacion: jest.fn().mockResolvedValue({ id: ORGANIZACION_ID }),
      // ADR-004 — consumido por KeycloakAuthGuard para resolver rolesPorOrganizacion de cada
      // operador de prueba (ver keycloak-auth.guard.ts).
      resolverRolesPorOrganizacionDeUsuario: jest
        .fn()
        .mockImplementation((userId: string, organizaciones: string[]) => {
          const roles = ROLES_POR_OPERADOR[userId] ?? {};
          const resultado: Record<string, string[]> = {};
          for (const organizacionId of organizaciones) {
            if (roles[organizacionId]) {
              resultado[organizacionId] = roles[organizacionId];
            }
          }
          return Promise.resolve(resultado);
        }),
    };

    app = await crearAppE2e({
      jwks: localJwks,
      coreClientService,
      keycloakAdminService,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /admin/activos/:id/baja + /reincorporacion + PATCH /responsable + /descripcion', () => {
    it('da de baja un activo', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/activos/activo-1/baja')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .send({ organizacionId: 'duoc-uc' })
        .expect(201);

      expect((res.body as ActivoResult).estado).toBe('dado_de_baja');
      expect(coreClientService.postActivoBaja).toHaveBeenCalledWith(
        'activo-1',
        expect.objectContaining({
          operadorId: 'op-patrimonial',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        }),
        expect.any(String),
      );
    });

    it('actualiza la descripcion', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/activos/activo-1/descripcion')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .send({
          organizacionId: 'duoc-uc',
          descripcion: 'Con rayón en la tapa',
        })
        .expect(200);

      expect((res.body as ActivoResult).descripcion).toBe(
        'Con rayón en la tapa',
      );
    });

    it('devuelve 401 sin Authorization', async () => {
      await request(app.getHttpServer())
        .post('/admin/activos/activo-1/baja')
        .send({ organizacionId: 'duoc-uc' })
        .expect(401);
    });
  });

  describe('GET/POST /admin/catalogo-tipos', () => {
    it('lista y crea tipos de catalogo', async () => {
      const listado = await request(app.getHttpServer())
        .get('/admin/catalogo-tipos')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .expect(200);
      expect(listado.body).toEqual([CATALOGO_TIPO_STUB]);

      const alta = await request(app.getHttpServer())
        .post('/admin/catalogo-tipos')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .send({
          organizacionId: 'duoc-uc',
          tipo: 'Silla',
          familia: 'Mobiliario',
          criticidad: 'baja',
          tecnologiaIdentificacion: 'qr',
        })
        .expect(201);
      expect(alta.body).toEqual(CATALOGO_TIPO_STUB);
    });
  });

  describe('POST/GET/DELETE /admin/activos/:id/documentos', () => {
    it('agrega, lista y elimina un documento', async () => {
      const alta = await request(app.getHttpServer())
        .post('/admin/activos/activo-1/documentos')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .send({
          organizacionId: 'duoc-uc',
          tipo: 'fotografia',
          url: 'https://ejemplo.org/foto.jpg',
        })
        .expect(201);
      expect(alta.body).toEqual(DOCUMENTO_STUB);

      const listado = await request(app.getHttpServer())
        .get('/admin/activos/activo-1/documentos')
        .query({ organizacionId: 'duoc-uc' })
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .expect(200);
      expect(listado.body).toEqual([DOCUMENTO_STUB]);

      await request(app.getHttpServer())
        .delete('/admin/activos/activo-1/documentos/documento-1')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .send({ organizacionId: 'duoc-uc' })
        .expect(204);
      expect(coreClientService.deleteDocumentoActivo).toHaveBeenCalled();
    });
  });

  describe('POST /admin/importaciones/contable', () => {
    it('importa filas y devuelve el resultado', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/importaciones/contable')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .send({
          organizacionId: 'duoc-uc',
          filas: [
            {
              codigoPatrimonial: 'AFT-1',
              codigoQr: 'QR-1',
              catalogoId: 'catalogo-notebook',
            },
          ],
        })
        .expect(201);
      expect(res.body).toEqual(IMPORTACION_STUB);
    });
  });

  describe('GET/POST /admin/organizaciones (Administrador del Sistema)', () => {
    it('lista organizaciones sin exigir rol', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/organizaciones')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .expect(200);
      expect(res.body).toEqual([ORGANIZACION_STUB]);
    });

    it('crea una organizacion cuando el operador tiene administrador-sistema', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/organizaciones')
        .set('Authorization', `Bearer ${tokenSistema}`)
        .send({
          organizacionId: 'duoc-uc',
          id: 'org-nueva',
          nombre: 'Organización Nueva',
        })
        .expect(201);
      expect(res.body).toEqual(ORGANIZACION_STUB);
    });
  });

  describe('GET /admin/indicadores', () => {
    // DOC-023 3 — hallazgo corregido: antes cualquier operador autenticado (incluido
    // administrador-patrimonial) podía leer indicadores de plataforma; ahora exige
    // administrador-sistema en cualquier organización (AdministradorSistemaEnCualquierOrganizacionGuard).
    it('devuelve los conteos de plataforma cuando el operador tiene administrador-sistema', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/indicadores')
        .set('Authorization', `Bearer ${tokenSistema}`)
        .expect(200);
      expect(res.body).toEqual(INDICADORES_STUB);
    });

    it('devuelve 403 si el operador tiene administrador-patrimonial pero no administrador-sistema', async () => {
      await request(app.getHttpServer())
        .get('/admin/indicadores')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .expect(403);
    });
  });

  describe('GET/POST /admin/organizaciones/:orgId/usuarios (asignar usuarios, Keycloak real)', () => {
    it('lista los usuarios de la organizacion cuando el operador tiene administrador-sistema', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/organizaciones/duoc-uc/usuarios')
        .set('Authorization', `Bearer ${tokenSistema}`)
        .expect(200);

      expect(res.body).toEqual(
        await keycloakAdminService.listarGrants.mock.results[0].value,
      );
      expect(keycloakAdminService.listarGrants).toHaveBeenCalledWith(
        ORGANIZACION_ID,
        expect.any(String),
      );
    });

    it('devuelve 403 si el operador tiene administrador-patrimonial pero no administrador-sistema', async () => {
      await request(app.getHttpServer())
        .get('/admin/organizaciones/duoc-uc/usuarios')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .expect(403);
    });

    it('asigna un usuario por email a la organizacion', async () => {
      await request(app.getHttpServer())
        .post('/admin/organizaciones/duoc-uc/usuarios')
        .set('Authorization', `Bearer ${tokenSistema}`)
        .send({ email: 'nuevo@duoc.cl', rol: 'administrador-patrimonial' })
        .expect(201);

      expect(keycloakAdminService.buscarUsuarioPorEmail).toHaveBeenCalledWith(
        'nuevo@duoc.cl',
        expect.any(String),
      );
      expect(keycloakAdminService.crearGrant).toHaveBeenCalledWith(
        ORGANIZACION_ID,
        'usuario-keycloak-1',
        'administrador-patrimonial',
        expect.any(String),
      );
    });

    it('devuelve 404 si el email no corresponde a ningún usuario de Keycloak', async () => {
      keycloakAdminService.buscarUsuarioPorEmail.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/admin/organizaciones/duoc-uc/usuarios')
        .set('Authorization', `Bearer ${tokenSistema}`)
        .send({ email: 'no-existe@duoc.cl', rol: 'administrador-patrimonial' })
        .expect(404);
    });
  });
});

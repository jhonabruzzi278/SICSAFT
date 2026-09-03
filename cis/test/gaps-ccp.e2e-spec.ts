import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { generateKeyPair, type JWTVerifyGetKey } from 'jose';
import type {
  ActivoResult,
  CatalogoTipoResult,
  DocumentoActivoResult,
  ImportacionContableResult,
} from './../src/core-client/core-client.types';
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

const IMPORTACION_STUB: ImportacionContableResult = {
  filas: [{ codigoPatrimonial: 'AFT-1', resultado: 'creado' }],
  creados: 1,
  yaImportados: 0,
  conflictos: 0,
};

// DOC-029 RF-B — bandeja de staging.
const LOTE_STUB = {
  id: 'lote-1',
  organizacionId: 'duoc-uc',
  origen: 'carpeta' as const,
  archivoNombre: 'activos.xls',
  recibidoEn: '2026-08-31T12:00:00.000Z',
  estado: 'pendiente_revision' as const,
  revisadoPor: null,
  revisadoEn: null,
  motivoRechazo: null,
  resumen: { totalFilas: 1, crear: 1, yaImportado: 0, conflicto: 0 },
};
const CREAR_LOTE_STUB = { loteId: 'lote-1', resumen: LOTE_STUB.resumen };
const LOTE_CON_FILAS_STUB = { lote: LOTE_STUB, filas: [] };

describe('DOC-021 — cierre de gaps del CCP (CIS e2e)', () => {
  let app: INestApplication<App>;
  let tokenPatrimonial: string;
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
    postImportacionContable: jest.Mock;
    postLoteImportacionContable: jest.Mock;
    getLotesImportacionContable: jest.Mock;
    getLoteImportacionContable: jest.Mock;
    postAprobarLoteImportacionContable: jest.Mock;
    postRechazarLoteImportacionContable: jest.Mock;
  };
  let keycloakAdminService: {
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
    const localJwks: JWTVerifyGetKey = () => Promise.resolve(publicKey);

    const ROLES_POR_OPERADOR: Record<string, Record<string, string[]>> = {
      'op-patrimonial': { [ORGANIZACION_ID]: ['administrador-patrimonial'] },
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
      postImportacionContable: jest.fn().mockResolvedValue(IMPORTACION_STUB),
      postLoteImportacionContable: jest.fn().mockResolvedValue(CREAR_LOTE_STUB),
      getLotesImportacionContable: jest.fn().mockResolvedValue([LOTE_STUB]),
      getLoteImportacionContable: jest
        .fn()
        .mockResolvedValue(LOTE_CON_FILAS_STUB),
      postAprobarLoteImportacionContable: jest
        .fn()
        .mockResolvedValue(IMPORTACION_STUB),
      postRechazarLoteImportacionContable: jest
        .fn()
        .mockResolvedValue({ estado: 'rechazado' }),
    };
    keycloakAdminService = {
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

  describe('DOC-029 RF-B — bandeja de staging /admin/importaciones/contable/lote', () => {
    const FILA = {
      linea: 1,
      codigoPatrimonial: 'DG-001',
      codigoQr: 'DG-001',
      catalogoId: 'catalogo-notebook',
      crudo: {},
    };

    it('POST crea un lote y devuelve loteId + resumen', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/importaciones/contable/lote')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .send({ organizacionId: 'duoc-uc', origen: 'carpeta', filas: [FILA] })
        .expect(201);
      expect(res.body).toEqual(CREAR_LOTE_STUB);
      expect(
        coreClientService.postLoteImportacionContable,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          organizacionId: 'duoc-uc',
          operadorId: 'op-patrimonial',
          origen: 'carpeta',
        }),
        expect.any(String),
      );
    });

    it('GET lista los lotes filtrando por estado', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/admin/importaciones/contable/lote?organizacionId=duoc-uc&estado=pendiente_revision',
        )
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .expect(200);
      expect(res.body).toEqual([LOTE_STUB]);
      expect(
        coreClientService.getLotesImportacionContable,
      ).toHaveBeenCalledWith(
        'duoc-uc',
        'pendiente_revision',
        expect.any(String),
      );
    });

    it('GET /:id devuelve el lote con sus filas', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/importaciones/contable/lote/lote-1')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .expect(200);
      expect(res.body).toEqual(LOTE_CON_FILAS_STUB);
    });

    it('POST /:id/aprobar ejecuta la importación', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/importaciones/contable/lote/lote-1/aprobar')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .send({ organizacionId: 'duoc-uc' })
        .expect(200);
      expect(res.body).toEqual(IMPORTACION_STUB);
      expect(
        coreClientService.postAprobarLoteImportacionContable,
      ).toHaveBeenCalledWith(
        'lote-1',
        expect.objectContaining({ operadorId: 'op-patrimonial' }),
        expect.any(String),
      );
    });

    it('POST /:id/rechazar cierra el lote', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/importaciones/contable/lote/lote-1/rechazar')
        .set('Authorization', `Bearer ${tokenPatrimonial}`)
        .send({ organizacionId: 'duoc-uc', motivo: 'no cuadra' })
        .expect(200);
      expect(res.body).toEqual({ estado: 'rechazado' });
    });

    it('rechaza sin token (401)', async () => {
      await request(app.getHttpServer())
        .get('/admin/importaciones/contable/lote?organizacionId=duoc-uc')
        .expect(401);
    });
  });
});

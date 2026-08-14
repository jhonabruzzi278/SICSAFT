import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SignJWT, generateKeyPair, type JWTVerifyGetKey } from 'jose';
import { AppModule } from './../src/app.module';
import { ZITADEL_JWKS } from './../src/common/auth/zitadel-auth.constants';
import { CoreClientService } from './../src/core-client/core-client.service';
import { REDIS_CLIENT } from './../src/redis/redis.constants';
import type {
  ActivoResult,
  AreaResult,
  AuditoriaEntradaResult,
  ContratoResult,
  ResponsableResult,
  UbicacionResult,
} from './../src/core-client/core-client.types';

const ISSUER = 'http://id.sicsaft.localhost';
const AUDIENCE = 'cis-api';
const ZITADEL_ORG_ID = '386029528616558597';
const ZITADEL_ROLES_CLAIM = 'urn:zitadel:iam:org:project:roles';

const ACTIVO_STUB: ActivoResult = {
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

const AUDITORIA_STUB: AuditoriaEntradaResult = {
  id: 'audit-1',
  usuario: 'op-1',
  fecha: '2026-08-14T10:00:00.000Z',
  equipo: null,
  ip: null,
  operacion: 'POST /inventarios',
  resultado: 'recibido',
  observaciones: null,
};

const AREA_STUB: AreaResult = {
  id: 'area-1',
  organizacionId: 'duoc-uc',
  codigo: 'BIB',
  nombre: 'Biblioteca',
  dependencia: null,
  centroCosto: null,
  responsableId: null,
  ubicacionPrincipalId: null,
};

const UBICACION_STUB: UbicacionResult = {
  id: 'ubicacion-1',
  sedeId: 'melipilla',
  edificio: null,
  piso: null,
  areaId: null,
  oficina: null,
  dependencia: null,
};

const RESPONSABLE_STUB: ResponsableResult = {
  id: 'responsable-1',
  identificacion: '11.111.111-1',
  nombre: 'Ana Soto',
  cargo: null,
  areaId: 'area-1',
  correo: null,
  telefono: null,
  estado: 'activo',
};

const CONTRATO_STUB: ContratoResult = {
  id: 'contrato-1',
  organizacionId: 'duoc-uc',
  organizacionNombre: 'DUOC UC',
  sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
  vigenciaDesde: '2026-01-01T00:00:00.000Z',
  vigenciaHasta: null,
  estado: 'vigente',
  modulosContratados: ['inventario-qr'],
};

// DOC-012 §5 (Fase 5) — el bug real que motivó este spec: `PATCH /admin/contratos/:id` usaba
// `@UsePipes()` a nivel de método, que valida TODOS los parámetros del handler (incluido
// `@Param('id')`, un string) contra un schema que espera un objeto — rompía con "Payload
// inválido" en cualquier request real, invisible en los specs unitarios del controller/service
// porque ahí se llama al método directo, sin pasar por el pipeline HTTP de Nest. Encontrado
// probando el flujo real desde `web/` contra CIS real.
describe('Administrador Patrimonial — DOC-012 §5/§7 (e2e)', () => {
  let app: INestApplication<App>;
  let bearerToken: string;
  let coreClientService: {
    postActivo: jest.Mock;
    getContratos: jest.Mock;
    postContrato: jest.Mock;
    patchContrato: jest.Mock;
    getAuditoria: jest.Mock;
    getAreas: jest.Mock;
    postArea: jest.Mock;
    patchArea: jest.Mock;
    getUbicaciones: jest.Mock;
    postUbicacion: jest.Mock;
    patchUbicacion: jest.Mock;
    getResponsables: jest.Mock;
    postResponsable: jest.Mock;
    patchResponsableEstado: jest.Mock;
  };

  beforeAll(() => {
    process.env.ZITADEL_ISSUER = ISSUER;
    process.env.ZITADEL_AUDIENCE = AUDIENCE;
    process.env.ZITADEL_ORG_ID_MAP = JSON.stringify({
      [ZITADEL_ORG_ID]: 'duoc-uc',
    });
  });

  beforeEach(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    bearerToken = await new SignJWT({
      [ZITADEL_ROLES_CLAIM]: {
        'administrador-patrimonial': { [ZITADEL_ORG_ID]: 'DUOC UC' },
      },
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('op-admin')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('15m')
      .sign(privateKey);

    const localJwks: JWTVerifyGetKey = () => Promise.resolve(publicKey);

    coreClientService = {
      postActivo: jest.fn().mockResolvedValue(ACTIVO_STUB),
      getContratos: jest.fn().mockResolvedValue([CONTRATO_STUB]),
      postContrato: jest.fn().mockResolvedValue(CONTRATO_STUB),
      patchContrato: jest
        .fn()
        .mockResolvedValue({ ...CONTRATO_STUB, estado: 'suspendido' }),
      getAuditoria: jest.fn().mockResolvedValue([AUDITORIA_STUB]),
      getAreas: jest.fn().mockResolvedValue([AREA_STUB]),
      postArea: jest.fn().mockResolvedValue(AREA_STUB),
      patchArea: jest
        .fn()
        .mockResolvedValue({ ...AREA_STUB, nombre: 'Biblioteca Central' }),
      getUbicaciones: jest.fn().mockResolvedValue([UBICACION_STUB]),
      postUbicacion: jest.fn().mockResolvedValue(UBICACION_STUB),
      patchUbicacion: jest
        .fn()
        .mockResolvedValue({ ...UBICACION_STUB, edificio: 'Torre A' }),
      getResponsables: jest.fn().mockResolvedValue([RESPONSABLE_STUB]),
      postResponsable: jest.fn().mockResolvedValue(RESPONSABLE_STUB),
      patchResponsableEstado: jest
        .fn()
        .mockResolvedValue({ ...RESPONSABLE_STUB, estado: 'inactivo' }),
    };

    const redisClient = {
      eval: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(0),
      set: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ZITADEL_JWKS)
      .useValue(localJwks)
      .overrideProvider(CoreClientService)
      .useValue(coreClientService)
      .overrideProvider(REDIS_CLIENT)
      .useValue(redisClient)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /admin/activos', () => {
    it('devuelve 401 sin Authorization', async () => {
      await request(app.getHttpServer())
        .post('/admin/activos')
        .send({
          organizacionId: 'duoc-uc',
          codigoPatrimonial: 'AFT-1',
          codigoQr: 'QR-1',
          catalogoId: 'catalogo-notebook',
        })
        .expect(401);
    });

    it('traduce el rol de Zitadel a organizacionId de CORE y devuelve el activo creado', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/activos')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({
          organizacionId: 'duoc-uc',
          codigoPatrimonial: 'AFT-1',
          codigoQr: 'QR-1',
          catalogoId: 'catalogo-notebook',
        })
        .expect(201);

      expect(res.body as ActivoResult).toEqual(ACTIVO_STUB);
      expect(coreClientService.postActivo).toHaveBeenCalledWith(
        expect.objectContaining({
          operadorId: 'op-admin',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        }),
        expect.any(String),
      );
    });
  });

  describe('GET /admin/contratos', () => {
    it('devuelve los contratos sin exigir el rol de escritura', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/contratos')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      expect(res.body).toEqual([CONTRATO_STUB]);
    });
  });

  describe('GET /admin/auditoria', () => {
    it('devuelve las entradas sin exigir el rol de escritura', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/auditoria')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      expect(res.body).toEqual([AUDITORIA_STUB]);
    });

    it('propaga los filtros como query params a CoreClientService.getAuditoria', async () => {
      await request(app.getHttpServer())
        .get('/admin/auditoria')
        .set('Authorization', `Bearer ${bearerToken}`)
        .query({ usuario: 'op-1', operacion: 'baja' })
        .expect(200);

      expect(coreClientService.getAuditoria).toHaveBeenCalledWith(
        { usuario: 'op-1', operacion: 'baja' },
        expect.any(String),
      );
    });

    it('devuelve 401 sin Authorization', async () => {
      await request(app.getHttpServer()).get('/admin/auditoria').expect(401);
    });
  });

  describe('POST /admin/contratos', () => {
    it('crea el contrato y devuelve 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/contratos')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({
          organizacionId: 'duoc-uc',
          sedeIds: ['melipilla'],
          vigenciaDesde: '2026-01-01T00:00:00.000Z',
          modulosContratados: ['inventario-qr'],
        })
        .expect(201);

      expect(res.body as ContratoResult).toEqual(CONTRATO_STUB);
    });
  });

  describe('PATCH /admin/contratos/:id', () => {
    it('actualiza el estado y devuelve el contrato — no rompe con "Payload inválido" (hallazgo real)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/contratos/contrato-1')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ organizacionId: 'duoc-uc', estado: 'suspendido' })
        .expect(200);

      expect((res.body as ContratoResult).estado).toBe('suspendido');
      expect(coreClientService.patchContrato).toHaveBeenCalledWith(
        'contrato-1',
        expect.objectContaining({
          operadorId: 'op-admin',
          estado: 'suspendido',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        }),
        expect.any(String),
      );
    });

    it('devuelve 403 si CORE rechaza por falta de rol (propagado, no colapsado a 502)', async () => {
      coreClientService.patchContrato.mockRejectedValue(
        new ForbiddenException({ message: 'sin permiso' }),
      );

      await request(app.getHttpServer())
        .patch('/admin/contratos/contrato-1')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ organizacionId: 'duoc-uc', estado: 'suspendido' })
        .expect(403);
    });
  });

  describe('GET /admin/areas + POST /admin/areas (RF-05)', () => {
    it('devuelve las areas sin exigir el rol de escritura', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/areas')
        .set('Authorization', `Bearer ${bearerToken}`)
        .query({ organizacionId: 'duoc-uc' })
        .expect(200);

      expect(res.body).toEqual([AREA_STUB]);
    });

    it('traduce el rol de Zitadel a organizacionId de CORE y devuelve el area creada', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/areas')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ organizacionId: 'duoc-uc', codigo: 'BIB', nombre: 'Biblioteca' })
        .expect(201);

      expect(res.body as AreaResult).toEqual(AREA_STUB);
      expect(coreClientService.postArea).toHaveBeenCalledWith(
        expect.objectContaining({
          operadorId: 'op-admin',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        }),
        expect.any(String),
      );
    });

    it('devuelve 401 sin Authorization', async () => {
      await request(app.getHttpServer())
        .get('/admin/areas')
        .query({ organizacionId: 'duoc-uc' })
        .expect(401);
    });
  });

  describe('PATCH /admin/areas/:id (cierra RF-05)', () => {
    it('actualiza el area y la devuelve — no rompe con "Payload inválido" (pipe por parametro desde el vamos)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/areas/area-1')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ organizacionId: 'duoc-uc', nombre: 'Biblioteca Central' })
        .expect(200);

      expect((res.body as AreaResult).nombre).toBe('Biblioteca Central');
      expect(coreClientService.patchArea).toHaveBeenCalledWith(
        'area-1',
        expect.objectContaining({
          operadorId: 'op-admin',
          nombre: 'Biblioteca Central',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        }),
        expect.any(String),
      );
    });

    it('devuelve 400 si el body no trae ningun campo a actualizar', async () => {
      await request(app.getHttpServer())
        .patch('/admin/areas/area-1')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ organizacionId: 'duoc-uc' })
        .expect(400);
    });
  });

  describe('GET /admin/ubicaciones + POST /admin/ubicaciones (RF-05)', () => {
    it('devuelve las ubicaciones sin exigir el rol de escritura', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/ubicaciones')
        .set('Authorization', `Bearer ${bearerToken}`)
        .query({ sedeId: 'melipilla' })
        .expect(200);

      expect(res.body).toEqual([UBICACION_STUB]);
    });

    it('crea la ubicacion y la devuelve', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/ubicaciones')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ organizacionId: 'duoc-uc', sedeId: 'melipilla' })
        .expect(201);

      expect(res.body as UbicacionResult).toEqual(UBICACION_STUB);
    });
  });

  describe('PATCH /admin/ubicaciones/:id (cierra RF-05)', () => {
    it('actualiza la ubicacion y la devuelve', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/ubicaciones/ubicacion-1')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ organizacionId: 'duoc-uc', edificio: 'Torre A' })
        .expect(200);

      expect((res.body as UbicacionResult).edificio).toBe('Torre A');
      expect(coreClientService.patchUbicacion).toHaveBeenCalledWith(
        'ubicacion-1',
        expect.objectContaining({
          operadorId: 'op-admin',
          edificio: 'Torre A',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        }),
        expect.any(String),
      );
    });

    it('devuelve 400 si el body no trae ningun campo a actualizar', async () => {
      await request(app.getHttpServer())
        .patch('/admin/ubicaciones/ubicacion-1')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ organizacionId: 'duoc-uc' })
        .expect(400);
    });
  });

  describe('GET /admin/responsables + POST /admin/responsables + PATCH /admin/responsables/:id/estado (RF-05)', () => {
    it('devuelve los responsables sin exigir el rol de escritura', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/responsables')
        .set('Authorization', `Bearer ${bearerToken}`)
        .query({ areaId: 'area-1' })
        .expect(200);

      expect(res.body).toEqual([RESPONSABLE_STUB]);
    });

    it('crea el responsable y lo devuelve', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/responsables')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({
          organizacionId: 'duoc-uc',
          identificacion: '11.111.111-1',
          nombre: 'Ana Soto',
          areaId: 'area-1',
        })
        .expect(201);

      expect(res.body as ResponsableResult).toEqual(RESPONSABLE_STUB);
    });

    it('actualiza el estado y lo devuelve — no rompe con "Payload inválido" (pipe por parametro desde el vamos)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/responsables/responsable-1/estado')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({ organizacionId: 'duoc-uc', estado: 'inactivo' })
        .expect(200);

      expect((res.body as ResponsableResult).estado).toBe('inactivo');
      expect(coreClientService.patchResponsableEstado).toHaveBeenCalledWith(
        'responsable-1',
        expect.objectContaining({
          operadorId: 'op-admin',
          estado: 'inactivo',
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        }),
        expect.any(String),
      );
    });
  });
});

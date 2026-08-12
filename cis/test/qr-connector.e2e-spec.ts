import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  AuthSessionResponse,
  CatalogoResponse,
  InventarioEstadoResponse,
  PostInventarioResponse,
} from './../src/qr-connector/qr-connector.types';

describe('Conector QR mock (e2e) — DOC-002', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /auth/session devuelve token y organizaciones', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/session')
      .send({ operadorId: 'op-1', credencial: 'x', deviceId: 'd-1' })
      .expect(201);

    const body = res.body as AuthSessionResponse;
    expect(body.accessToken).toContain('mock-token-');
    expect(body.organizaciones[0].id).toBe('duoc-uc');
  });

  it('POST /auth/session con payload invalido devuelve 400 con errores', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/session')
      .send({})
      .expect(400);

    const body = res.body as { errores: unknown[] };
    expect(body.errores.length).toBeGreaterThan(0);
  });

  it('GET /catalogo filtra por organizacionId', async () => {
    const res = await request(app.getHttpServer())
      .get('/catalogo')
      .query({ organizacionId: 'duoc-uc' })
      .expect(200);

    const body = res.body as CatalogoResponse;
    expect(body.activos.length).toBeGreaterThan(0);
  });

  it('flujo completo: POST /inventarios y luego GET estado', async () => {
    const inventarioReq = {
      correlationId: 'corr-e2e',
      idempotencyKey: 'idem-e2e',
      operadorId: 'op-1',
      organizacionId: 'duoc-uc',
      areaId: 'laboratorio-informatica',
      ubicacionId: 'melipilla',
      fechaInicio: '2026-08-12T10:00:00.000Z',
      fechaCierre: '2026-08-12T11:00:00.000Z',
      escaneos: [{ codigoQr: 'QR-0001', resultado: 'correcto' }],
      incidencias: [],
    };

    const postRes = await request(app.getHttpServer())
      .post('/inventarios')
      .send(inventarioReq)
      .expect(201);

    const postBody = postRes.body as PostInventarioResponse;
    expect(postBody.estado).toBe('recibido');

    const estadoRes = await request(app.getHttpServer())
      .get(`/inventarios/${postBody.inventarioId}/estado`)
      .expect(200);

    const estadoBody = estadoRes.body as InventarioEstadoResponse;
    expect(estadoBody.estado).toBe('recibido');
  });

  it('POST /inventarios con organizacion inexistente devuelve 400', async () => {
    await request(app.getHttpServer())
      .post('/inventarios')
      .send({
        correlationId: 'c',
        idempotencyKey: 'k-invalida',
        operadorId: 'op-1',
        organizacionId: 'no-existe',
        areaId: 'a',
        ubicacionId: 'u',
        fechaInicio: 'x',
        fechaCierre: 'y',
        escaneos: [],
        incidencias: [],
      })
      .expect(400);
  });

  it('GET /inventarios/:id/estado con id inexistente devuelve 404', async () => {
    await request(app.getHttpServer())
      .get('/inventarios/no-existe/estado')
      .expect(404);
  });
});

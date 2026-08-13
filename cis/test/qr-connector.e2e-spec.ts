import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SignJWT, generateKeyPair, type JWTVerifyGetKey } from 'jose';
import { AppModule } from './../src/app.module';
import { ZITADEL_JWKS } from './../src/common/auth/zitadel-auth.constants';
import { CoreClientService } from './../src/core-client/core-client.service';
import {
  AuthSessionResponse,
  CatalogoResponse,
  InventarioEstadoResponse,
  PostInventarioResponse,
} from './../src/qr-connector/qr-connector.types';

const ISSUER = 'http://id.sicsaft.localhost';
const AUDIENCE = 'cis-api';

const ENTITLEMENTS_STUB = {
  organizaciones: [
    {
      id: 'duoc-uc',
      nombre: 'DUOC UC',
      sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
    },
  ],
};

describe('Conector QR (e2e) — DOC-002 + auth Zitadel (ADR-002) + entitlements de CORE', () => {
  let app: INestApplication<App>;
  let bearerToken: string;
  let coreClientService: { getEntitlements: jest.Mock };

  beforeAll(() => {
    process.env.ZITADEL_ISSUER = ISSUER;
    process.env.ZITADEL_AUDIENCE = AUDIENCE;
  });

  beforeEach(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    bearerToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('op-1')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('15m')
      .sign(privateKey);

    // Se reemplaza el JWKS remoto (createRemoteJWKSet contra un Zitadel real, ver
    // zitadel-auth.module.ts) por la llave publica local — el e2e prueba el guard de punta a
    // punta vía HTTP real sin depender de que haya un Zitadel corriendo.
    const localJwks: JWTVerifyGetKey = () => Promise.resolve(publicKey);

    // Idem para CORE: se reemplaza el cliente HTTP real por un stub — el e2e prueba
    // QrConnectorController + guard + servicio de punta a punta vía HTTP real, sin depender de
    // que haya un CORE corriendo (CoreClientService.getEntitlements ya tiene su propia
    // cobertura unitaria contra HttpService mockeado, ver core-client.service.spec.ts).
    coreClientService = {
      getEntitlements: jest.fn().mockResolvedValue(ENTITLEMENTS_STUB),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ZITADEL_JWKS)
      .useValue(localJwks)
      .overrideProvider(CoreClientService)
      .useValue(coreClientService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /auth/session sin Authorization devuelve 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/session')
      .send({ deviceId: 'd-1' })
      .expect(401);
  });

  it('POST /auth/session con token Zitadel valido devuelve el mismo token y las organizaciones de CORE', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/session')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({ deviceId: 'd-1' })
      .expect(201);

    const body = res.body as AuthSessionResponse;
    expect(body.accessToken).toBe(bearerToken);
    expect(body.organizaciones).toEqual(ENTITLEMENTS_STUB.organizaciones);
    // El correlationId lo genera CorrelationIdMiddleware (no llega ninguno en la request) —
    // se verifica que CoreClientService reciba el mismo valor que la response expuso.
    expect(res.headers['x-correlation-id']).toEqual(expect.any(String));
    expect(coreClientService.getEntitlements).toHaveBeenCalledWith(
      'op-1',
      res.headers['x-correlation-id'],
    );
  });

  it('POST /auth/session devuelve 502 si CORE no responde', async () => {
    coreClientService.getEntitlements.mockRejectedValue(
      new BadGatewayException({
        message: 'No se pudo resolver entitlements contra CORE',
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/session')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({ deviceId: 'd-1' })
      .expect(502);
  });

  it('POST /auth/session con payload invalido devuelve 400 con errores', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/session')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({})
      .expect(400);

    const body = res.body as { errores: unknown[] };
    expect(body.errores.length).toBeGreaterThan(0);
  });

  it('GET /catalogo sin Authorization devuelve 401', async () => {
    await request(app.getHttpServer())
      .get('/catalogo')
      .query({ organizacionId: 'duoc-uc' })
      .expect(401);
  });

  it('GET /catalogo filtra por organizacionId con token valido', async () => {
    const res = await request(app.getHttpServer())
      .get('/catalogo')
      .set('Authorization', `Bearer ${bearerToken}`)
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
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(inventarioReq)
      .expect(201);

    const postBody = postRes.body as PostInventarioResponse;
    expect(postBody.estado).toBe('recibido');

    const estadoRes = await request(app.getHttpServer())
      .get(`/inventarios/${postBody.inventarioId}/estado`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .expect(200);

    const estadoBody = estadoRes.body as InventarioEstadoResponse;
    expect(estadoBody.estado).toBe('recibido');
  });

  it('POST /inventarios con organizacion inexistente devuelve 400', async () => {
    await request(app.getHttpServer())
      .post('/inventarios')
      .set('Authorization', `Bearer ${bearerToken}`)
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
      .set('Authorization', `Bearer ${bearerToken}`)
      .expect(404);
  });

  it('GET /inventarios/:id/estado con token invalido devuelve 401', async () => {
    await request(app.getHttpServer())
      .get('/inventarios/no-existe/estado')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });
});

import { BadGatewayException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SignJWT, generateKeyPair, type JWTVerifyGetKey } from 'jose';
import { crearAppE2e } from './support/e2e-app';

const ISSUER = 'http://id.sicsaft.localhost/realms/sicsaft';
const AUDIENCE = 'cis-api';

const SYNC_INFO = { actualizadoEn: '2026-08-18T10:00:00.000Z', alDia: true };

// DOC-019 3.1/4 — prueba DashboardConnectorController + guard de punta a punta vía HTTP real,
// mismo patrón que qr-connector.e2e-spec.ts: CipClientService se reemplaza por un stub (ya tiene
// su propia cobertura unitaria contra HttpService mockeado, ver cip-client.service.spec.ts) — acá
// se prueba que el controller exige el mismo KeycloakAuthGuard que Activos/Inventarios (sin rol
// adicional, DOC-019 2) y que delega correctamente en el cliente de CIP. Sin claim `organization`
// en el token (mismo criterio que qr-connector.e2e-spec.ts): no hace falta stubear
// KeycloakAdminService.
describe('Dashboard (e2e) — DOC-019, proxy CIS→CIP', () => {
  let app: INestApplication<App>;
  let bearerToken: string;
  let cipClientService: {
    getCobertura: jest.Mock;
    getAreas: jest.Mock;
    getSesiones: jest.Mock;
    getFueraDeArea: jest.Mock;
    getNoLocalizados: jest.Mock;
    getIncidencias: jest.Mock;
    getEstadoActivos: jest.Mock;
    getCategorias: jest.Mock;
  };

  beforeEach(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    bearerToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('op-1')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('15m')
      .sign(privateKey);

    const localJwks: JWTVerifyGetKey = () => Promise.resolve(publicKey);

    cipClientService = {
      getCobertura: jest.fn().mockResolvedValue({
        activosRegistrados: 3,
        activosEscaneados: 1,
        porcentajeCobertura: 0.333,
        ...SYNC_INFO,
      }),
      getAreas: jest.fn().mockResolvedValue({
        areas: [
          { areaId: 'area-1', controladaEnPeriodo: true, ultimaSesionEn: null },
        ],
        ...SYNC_INFO,
      }),
      getSesiones: jest.fn().mockResolvedValue({
        items: [
          {
            sesionId: 'sesion-1',
            areaId: 'area-1',
            veredicto: 'exitoso',
            fechaCierre: '2026-08-18T09:00:00.000Z',
          },
        ],
        total: 1,
        ...SYNC_INFO,
      }),
      getFueraDeArea: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        ...SYNC_INFO,
      }),
      getNoLocalizados: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        ...SYNC_INFO,
      }),
      getIncidencias: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        ...SYNC_INFO,
      }),
      getEstadoActivos: jest.fn().mockResolvedValue({
        estados: [{ estado: 'activo', cantidad: 3 }],
        ...SYNC_INFO,
      }),
      getCategorias: jest.fn().mockResolvedValue({
        categorias: [{ areaId: 'area-1', familia: 'Informática', cantidad: 2 }],
        ...SYNC_INFO,
      }),
    };

    app = await crearAppE2e({
      jwks: localJwks,
      coreClientService: {},
      cipClientService,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /dashboard/cobertura sin Authorization devuelve 401', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/cobertura')
      .query({ organizacionId: 'duoc-uc' })
      .expect(401);
  });

  it('GET /dashboard/cobertura con token válido devuelve la cobertura de CIP', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/cobertura')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(200);

    expect(res.body).toEqual({
      activosRegistrados: 3,
      activosEscaneados: 1,
      porcentajeCobertura: 0.333,
      ...SYNC_INFO,
    });
    expect(cipClientService.getCobertura).toHaveBeenCalledWith(
      'duoc-uc',
      expect.any(String),
    );
  });

  it('GET /dashboard/cobertura sin organizacionId devuelve 400', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/cobertura')
      .set('Authorization', `Bearer ${bearerToken}`)
      .expect(400);
  });

  it('GET /dashboard/areas devuelve las áreas controladas', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/areas')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(200);

    const body = res.body as { areas: unknown[] };
    expect(body.areas).toHaveLength(1);
  });

  it('GET /dashboard/sesiones acepta areaId y paginación', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/sesiones')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({
        organizacionId: 'duoc-uc',
        areaId: 'area-1',
        limit: 10,
        offset: 0,
      })
      .expect(200);

    const body = res.body as { items: unknown[]; total: number };
    expect(body.total).toBe(1);
    expect(cipClientService.getSesiones).toHaveBeenCalledWith(
      'duoc-uc',
      'area-1',
      { limit: 10, offset: 0 },
      expect.any(String),
    );
  });

  it('GET /dashboard/fuera-de-area devuelve una página vacía', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/fuera-de-area')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(200);

    expect((res.body as { total: number }).total).toBe(0);
  });

  it('GET /dashboard/no-localizados devuelve una página vacía', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/no-localizados')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(200);

    expect((res.body as { total: number }).total).toBe(0);
  });

  it('GET /dashboard/incidencias acepta codigoQr', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/incidencias')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc', codigoQr: 'QR-1' })
      .expect(200);

    expect(cipClientService.getIncidencias).toHaveBeenCalledWith(
      'duoc-uc',
      'QR-1',
      { limit: 20, offset: 0 },
      expect.any(String),
    );
  });

  it('GET /dashboard/estado-activos devuelve el resumen por estado', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/estado-activos')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(200);

    const body = res.body as { estados: { estado: string }[] };
    expect(body.estados[0]?.estado).toBe('activo');
  });

  it('GET /dashboard/categorias acepta areaId', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/categorias')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc', areaId: 'area-1' })
      .expect(200);

    const body = res.body as { categorias: { familia: string }[] };
    expect(body.categorias[0]?.familia).toBe('Informática');
  });

  it('GET /dashboard/cobertura devuelve 502 si CIP no responde', async () => {
    cipClientService.getCobertura.mockRejectedValue(
      new BadGatewayException({
        message: 'No se pudo resolver /dashboard/cobertura contra CIP',
      }),
    );

    await request(app.getHttpServer())
      .get('/dashboard/cobertura')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(502);
  });

  it('devuelve 429 cuando el operador supera el límite de requests (RateLimitGuard, WAF 4)', async () => {
    // ADR-005 — InMemoryRateLimiter no se puede pre-cargar como el stub de Redis: se dispara el
    // límite real (30 requests/10s, ver rate-limit.module.ts) haciendo suficientes requests.
    const LIMITE = 30;
    for (let i = 0; i < LIMITE; i += 1) {
      await request(app.getHttpServer())
        .get('/dashboard/cobertura')
        .set('Authorization', `Bearer ${bearerToken}`)
        .query({ organizacionId: 'duoc-uc' })
        .expect(200);
    }

    await request(app.getHttpServer())
      .get('/dashboard/cobertura')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(429);
  });
});

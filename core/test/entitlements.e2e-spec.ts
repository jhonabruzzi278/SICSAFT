import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import { EntitlementsResponse } from './../src/entitlements/entitlements.types';
import { crearAppE2e, SERVICE_TOKEN } from './support/e2e-app';

describe('GET /entitlements (e2e) — DOC-004 §6 + auth servicio-a-servicio', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await crearAppE2e();
  });

  afterEach(async () => {
    await app.close();
  });

  it('devuelve las organizaciones con contrato vigente para el operador', async () => {
    const res = await request(app.getHttpServer())
      .get('/entitlements')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .query({ operadorId: 'op-1' })
      .expect(200);

    const body = res.body as EntitlementsResponse;
    expect(body.organizaciones).toHaveLength(1);
    expect(body.organizaciones[0]).toEqual({
      id: 'duoc-uc',
      nombre: 'DUOC UC',
      sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
    });
  });

  it('devuelve 400 sin operadorId (con service token valido)', async () => {
    const res = await request(app.getHttpServer())
      .get('/entitlements')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .expect(400);

    const body = res.body as { errores: unknown[] };
    expect(body.errores.length).toBeGreaterThan(0);
  });

  it('devuelve 401 sin el header de service token', async () => {
    await request(app.getHttpServer())
      .get('/entitlements')
      .query({ operadorId: 'op-1' })
      .expect(401);
  });

  it('devuelve 401 con un service token invalido', async () => {
    await request(app.getHttpServer())
      .get('/entitlements')
      .set(SERVICE_TOKEN_HEADER, 'token-invalido')
      .query({ operadorId: 'op-1' })
      .expect(401);
  });
});

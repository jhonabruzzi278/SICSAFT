import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { EntitlementsResponse } from './../src/entitlements/entitlements.types';

describe('GET /entitlements (e2e) — DOC-004 §6', () => {
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

  it('devuelve las organizaciones con contrato vigente para el operador', async () => {
    const res = await request(app.getHttpServer())
      .get('/entitlements')
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

  it('devuelve 400 sin operadorId', async () => {
    const res = await request(app.getHttpServer())
      .get('/entitlements')
      .expect(400);

    const body = res.body as { errores: unknown[] };
    expect(body.errores.length).toBeGreaterThan(0);
  });
});

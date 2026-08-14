import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ServiceInfo } from './../src/app.controller';
import { HealthStatus } from './../src/health/health.controller';
import { crearAppE2e } from './support/e2e-app';

describe('SICSAFT CORE (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await crearAppE2e();
  });

  it('GET / returns service identity', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        const body = res.body as ServiceInfo;
        expect(body.service).toContain('CORE');
      });
  });

  it('GET /health returns ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as HealthStatus;
        expect(body.status).toBe('ok');
        expect(body.service).toBe('core');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ServiceInfo } from './../src/app.controller';
import { HealthStatus } from './../src/health/health.controller';

describe('SICSAFT CORE (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
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

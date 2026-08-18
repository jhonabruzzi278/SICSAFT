import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import { PG_POOL } from './../src/database/database.constants';
import type {
  Pagina,
  VeredictoSesionResponse,
} from './../src/dashboard/dashboard.types';
import { crearAppE2e, SERVICE_TOKEN } from './support/e2e-app';

// DOC-018 6 — API de lectura contra la base `cip` real (migracion 1755700000000 ya aplicada,
// ver README de desarrollo local). No usa el seed de CORE: inserta directo en las tablas de
// agregados, que es exactamente lo que haría el worker — este spec prueba la API, no el worker
// (eso ya lo cubre agregacion/*.spec.ts con mocks + el e2e de CORE que prueba el trigger real).
describe('DashboardController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  beforeEach(async () => {
    app = await crearAppE2e();
    pool = app.get(PG_POOL);
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /dashboard/cobertura devuelve 401 sin service token', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/cobertura')
      .query({ organizacionId: 'org-e2e' })
      .expect(401);
  });

  it('GET /dashboard/cobertura devuelve 0 para una organización sin datos todavía', async () => {
    const organizacionId = `org-e2e-${randomUUID()}`;

    const res = await request(app.getHttpServer())
      .get('/dashboard/cobertura')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .query({ organizacionId })
      .expect(200);

    expect(res.body).toMatchObject({
      activosRegistrados: 0,
      activosEscaneados: 0,
      porcentajeCobertura: 0,
    });
    expect(res.body).toHaveProperty('alDia');
  });

  it('GET /dashboard/cobertura devuelve los datos reales insertados', async () => {
    const organizacionId = `org-e2e-${randomUUID()}`;
    await pool.query(
      `INSERT INTO cobertura_organizacion (organizacion_id, activos_registrados, activos_escaneados, porcentaje_cobertura)
       VALUES ($1, 10, 4, 0.4)`,
      [organizacionId],
    );

    const res = await request(app.getHttpServer())
      .get('/dashboard/cobertura')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .query({ organizacionId })
      .expect(200);

    expect(res.body).toMatchObject({
      activosRegistrados: 10,
      activosEscaneados: 4,
      porcentajeCobertura: 0.4,
    });
  });

  it('GET /dashboard/sesiones pagina y filtra por área', async () => {
    const organizacionId = `org-e2e-${randomUUID()}`;
    const areaA = `area-a-${randomUUID()}`;
    const areaB = `area-b-${randomUUID()}`;
    await pool.query(
      `INSERT INTO veredicto_sesion (sesion_id, organizacion_id, area_id, veredicto, fecha_cierre)
       VALUES ($1, $2, $3, 'exitoso', now()), ($4, $2, $5, 'aceptable', now())`,
      [randomUUID(), organizacionId, areaA, randomUUID(), areaB],
    );

    const res = await request(app.getHttpServer())
      .get('/dashboard/sesiones')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .query({ organizacionId, areaId: areaA })
      .expect(200);

    const body = res.body as Pagina<VeredictoSesionResponse>;
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].veredicto).toBe('exitoso');
  });

  it('GET /dashboard/categorias devuelve 400 si falta organizacionId', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/categorias')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .expect(400);
  });
});

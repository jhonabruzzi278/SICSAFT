import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import request from 'supertest';
import { App } from 'supertest/types';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import {
  CIP_EVENTOS_PGBOSS,
  CIP_EVENTOS_QUEUE_NAME,
} from './../src/eventos-outbox/eventos-outbox.constants';
import { EventosOutboxDispatcher } from './../src/eventos-outbox/eventos-outbox.dispatcher';
import { EventosOutboxRepository } from './../src/eventos-outbox/eventos-outbox.repository';
import type { PostInventarioResponse } from './../src/inventarios/inventarios.types';
import { crearAppE2e, SERVICE_TOKEN } from './support/e2e-app';

// Fase 6 — prueba el trigger de la migracion 1755500000000 de verdad (no un mock de el, ver
// cip/aidlc-docs/testing/TEST_STRATEGY.md 1): un POST /inventarios real contra el seed de
// DOC-005 (duoc-uc / QR-000001) debe dejar una fila en eventos_outbox, y el dispatcher debe
// publicarla a la cola real y marcarla — de punta a punta, sin mocks de Postgres (ADR-005: la
// cola en sí también es Postgres, vía pg-boss, contra la base EVENTOS_OUTBOX_DATABASE_URL).
function buildInventarioPayload(): Record<string, unknown> {
  return {
    correlationId: 'corr-e2e-outbox',
    idempotencyKey: `idem-e2e-outbox-${randomUUID()}`,
    operadorId: 'op-e2e-outbox',
    organizacionId: 'duoc-uc',
    areaId: 'area-biblioteca',
    ubicacionId: 'ubicacion-biblioteca-101',
    fechaInicio: '2026-02-01T09:00:00.000Z',
    fechaCierre: '2026-02-01T09:30:00.000Z',
    escaneos: [{ codigoQr: 'QR-000001', resultado: 'correcto' }],
    incidencias: [],
  };
}

describe('EventosOutboxModule (e2e)', () => {
  let app: INestApplication<App>;
  let repository: EventosOutboxRepository;
  let dispatcher: EventosOutboxDispatcher;
  let boss: PgBoss;

  beforeEach(async () => {
    app = await crearAppE2e();
    repository = app.get(EventosOutboxRepository);
    dispatcher = app.get(EventosOutboxDispatcher);
    boss = app.get(CIP_EVENTOS_PGBOSS);
  });

  afterEach(async () => {
    await app.close();
  });

  it('el trigger escribe en eventos_outbox y el dispatcher publica y marca la sesión', async () => {
    const res = await request(app.getHttpServer())
      .post('/inventarios')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(buildInventarioPayload())
      .expect(201);
    const sesionId = (res.body as PostInventarioResponse).inventarioId;

    const pendientesAntes = await repository.findPendientes(1000);
    const propio = pendientesAntes.find((p) => p.sesionId === sesionId);
    expect(propio).toBeDefined();
    expect(propio?.organizacionId).toBe('duoc-uc');

    await dispatcher.despachar();

    const pendientesDespues = await repository.findPendientes(1000);
    expect(pendientesDespues.some((p) => p.sesionId === sesionId)).toBe(false);

    const trabajos = await boss.findJobs(CIP_EVENTOS_QUEUE_NAME, {
      data: { kind: 'sesion-cerrada', sesionId },
    });
    expect(trabajos.length).toBeGreaterThan(0);
  });

  it('un reintento con la misma idempotencyKey no duplica filas en eventos_outbox', async () => {
    const payload = buildInventarioPayload();

    const primeraRes = await request(app.getHttpServer())
      .post('/inventarios')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(payload)
      .expect(201);
    const sesionId = (primeraRes.body as PostInventarioResponse).inventarioId;

    await request(app.getHttpServer())
      .post('/inventarios')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(payload)
      .expect(201);

    const pendientes = await repository.findPendientes(1000);
    const deEstaSesion = pendientes.filter((p) => p.sesionId === sesionId);
    expect(deEstaSesion).toHaveLength(1);
  });
});

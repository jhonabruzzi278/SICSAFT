import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CORRELATION_ID_HEADER } from './common/correlation-id/correlation-id.constants';

const DEFAULT_PORT = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // CIS_CORS_ORIGIN es opcional y sin default — si no esta seteada, CORS queda deshabilitado
  // (comportamiento actual, sin romper nada existente). Solo hace falta para que un navegador
  // (APP QR, TASK-007) le pueda hablar directo a CIS; llamadas servicio-a-servicio (CIS->CORE)
  // no pasan por un browser y no necesitan esto. `X-Correlation-Id` se expone explicitamente
  // porque un header de respuesta no-simple no es legible desde `fetch()` sin `exposedHeaders`.
  const corsOrigin = process.env.CIS_CORS_ORIGIN;
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((origin) => origin.trim()),
      // PATCH: DOC-012 7 (Fase 5), PATCH /admin/contratos/:id — WEB es el primer cliente que
      // necesita este método desde un navegador (APP QR solo usa GET/POST). DELETE: hallazgo real
      // verificado en vivo (DOC-024) — DELETE /admin/activos/:id/documentos/:documentoId (DOC-021
      // 3) y DELETE /admin/organizaciones/:orgId/usuarios/:userId (DOC-024) fallaban en el
      // preflight de CORS desde un navegador real (nunca se habían probado así, solo via
      // supertest/curl, que no aplican CORS) — sin este método, ambos devuelven "Failed to fetch"
      // pese a que el propio endpoint funciona perfecto.
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type', CORRELATION_ID_HEADER],
      exposedHeaders: [CORRELATION_ID_HEADER],
    });
  }

  const port = process.env.PORT ?? DEFAULT_PORT;
  await app.listen(port);
}

void bootstrap();

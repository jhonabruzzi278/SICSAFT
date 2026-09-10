import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { CORRELATION_ID_HEADER } from './common/correlation-id/correlation-id.constants';

// Límite del cuerpo JSON. El default de Express (100 kb) no alcanza para el caso real que este
// sistema tiene que soportar: el lote de la ingesta contable viaja como un único POST con todas
// las filas del Excel del contador. Medido sobre el archivo real del cliente
// (CU-PAT-TODAS-LAS-DIRECCIONES): 252 activos = 165 KB de JSON compacto (~650 bytes por fila)
// — más del doble del default, y CIS devolvía `413 request entity too large` sin que el operador
// tuviera forma de saber por qué (bug real 2026-09-09). Con 10 MB entran ~11.000 activos en un
// solo lote; un inventario más grande que eso hay que partirlo, no subirle el número a esto.
const LIMITE_CUERPO_JSON = '10mb';

const DEFAULT_PORT = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: LIMITE_CUERPO_JSON });

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

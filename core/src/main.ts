import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;

// Límite del cuerpo JSON. El default de Express (100 kb) no alcanza para el caso real que este
// sistema tiene que soportar: el lote de la ingesta contable viaja como un único POST con todas
// las filas del Excel del contador. Medido sobre el archivo real del cliente
// (CU-PAT-TODAS-LAS-DIRECCIONES): 252 activos = 165 KB de JSON compacto (~650 bytes por fila)
// — más del doble del default, y CIS devolvía `413 request entity too large` sin que el operador
// tuviera forma de saber por qué (bug real 2026-09-09). Con 10 MB entran ~11.000 activos en un
// solo lote; un inventario más grande que eso hay que partirlo, no subirle el número a esto.
const LIMITE_CUERPO_JSON = '10mb';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: LIMITE_CUERPO_JSON });
  const port = process.env.PORT ?? DEFAULT_PORT;
  await app.listen(port);
}

void bootstrap();

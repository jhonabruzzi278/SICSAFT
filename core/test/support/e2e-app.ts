import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

// Compartido por todos los e2e specs (evita duplicar el bootstrap de Nest + el token/rol de
// prueba en cada archivo — SonarCloud lo marcaba como duplicacion real entre specs).
export const SERVICE_TOKEN = 'secreto-compartido-e2e'; // igual al default de jest-e2e.setup.ts
// El rol es de Proyecto pero asignado por organizacion (DOC-012 2) — nunca una lista plana.
export const ADMIN_ROLES_DUOC_UC = { 'duoc-uc': ['administrador-patrimonial'] };

export async function crearAppE2e(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication<App> = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

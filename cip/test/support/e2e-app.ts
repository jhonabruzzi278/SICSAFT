import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

export const SERVICE_TOKEN = 'secreto-compartido-e2e'; // igual al default de jest-e2e.setup.ts

export async function crearAppE2e(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication<App> = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

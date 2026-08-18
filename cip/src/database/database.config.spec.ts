import { loadDatabaseConfig } from './database.config';

describe('loadDatabaseConfig', () => {
  it('lee la config completa del env', () => {
    const config = loadDatabaseConfig({
      CIP_DB_HOST: 'postgres',
      CIP_DB_PORT: '5433',
      CIP_DB_NAME: 'cip',
      CIP_DB_USER: 'cip',
      CIP_DB_PASSWORD: 'secreto',
    });

    expect(config).toEqual({
      host: 'postgres',
      port: 5433,
      database: 'cip',
      user: 'cip',
      password: 'secreto',
    });
  });

  it('usa 5432 por defecto si no se especifica CIP_DB_PORT', () => {
    const config = loadDatabaseConfig({
      CIP_DB_HOST: 'postgres',
      CIP_DB_NAME: 'cip',
      CIP_DB_USER: 'cip',
      CIP_DB_PASSWORD: 'secreto',
    });

    expect(config.port).toBe(5432);
  });

  it('lanza si falta alguna variable requerida', () => {
    expect(() => loadDatabaseConfig({})).toThrow(
      'Configuración de base de datos de CIP inválida',
    );
  });
});

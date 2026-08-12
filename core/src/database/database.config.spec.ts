import { loadDatabaseConfig } from './database.config';

describe('loadDatabaseConfig', () => {
  it('lee la config completa del env', () => {
    const config = loadDatabaseConfig({
      CORE_DB_HOST: 'postgres',
      CORE_DB_PORT: '5433',
      CORE_DB_NAME: 'core',
      CORE_DB_USER: 'core',
      CORE_DB_PASSWORD: 'secreto',
    });

    expect(config).toEqual({
      host: 'postgres',
      port: 5433,
      database: 'core',
      user: 'core',
      password: 'secreto',
    });
  });

  it('usa 5432 por defecto si no se especifica CORE_DB_PORT', () => {
    const config = loadDatabaseConfig({
      CORE_DB_HOST: 'postgres',
      CORE_DB_NAME: 'core',
      CORE_DB_USER: 'core',
      CORE_DB_PASSWORD: 'secreto',
    });

    expect(config.port).toBe(5432);
  });

  it('lanza si falta alguna variable requerida', () => {
    expect(() => loadDatabaseConfig({})).toThrow(
      'Configuración de base de datos de CORE inválida',
    );
  });
});

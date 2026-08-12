import { Global, Module, type OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { loadDatabaseConfig } from './database.config';
import { PG_POOL } from './database.constants';

// Global: cualquier repositorio interno de CORE (hoy solo ContratoRepository, mañana los
// motores sobre el resto de Base Patrimonial) necesita el pool sin reimportar el modulo cada
// vez — mismo patron que ServiceTokenModule.
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const config = loadDatabaseConfig();
        return new Pool({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
        });
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

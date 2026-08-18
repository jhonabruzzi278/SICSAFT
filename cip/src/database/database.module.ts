import { Global, Module, type OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { loadDatabaseConfig } from './database.config';
import { PG_POOL } from './database.constants';

// Global: mismo patron que core/src/database/database.module.ts.
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

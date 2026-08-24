import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { DatabaseModule } from './database/database.module';
import { ServiceTokenModule } from './common/auth/service-token.module';
import { HealthModule } from './health/health.module';
import { AgregacionModule } from './agregacion/agregacion.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    // GET /metrics -- formato Prometheus (prom-client), target real en observability/prometheus.yml.
    PrometheusModule.register(),
    DatabaseModule,
    ServiceTokenModule,
    HealthModule,
    // DOC-018 5 — worker que consume la cola cip-eventos que ya publica CORE (PR #8) y escribe
    // los agregados.
    AgregacionModule,
    // DOC-018 6 — API de lectura sobre esos mismos agregados.
    DashboardModule,
  ],
})
export class AppModule {}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { ServiceTokenModule } from './common/auth/service-token.module';
import { DatabaseModule } from './database/database.module';
import { CorrelationIdMiddleware } from './common/correlation-id/correlation-id.middleware';
import { PatrimonialModule } from './patrimonial/patrimonial.module';
import { OrquestadorModule } from './orquestador/orquestador.module';
import { EventosOutboxModule } from './eventos-outbox/eventos-outbox.module';
import { IndicadoresModule } from './indicadores/indicadores.module';

@Module({
  imports: [
    // GET /metrics -- formato Prometheus (prom-client), target real en observability/prometheus.yml
    // (reemplaza el placeholder comentado que esperaba esto desde Fase 3.1).
    PrometheusModule.register(),
    ServiceTokenModule,
    DatabaseModule,
    HealthModule,
    EntitlementsModule,
    // Fase 2 (ROADMAP.md): Motor Patrimonial (GET /catalogo) + Orquestador (POST /inventarios,
    // GET /inventarios/:id/estado — este ultimo trae InventariosModule/EventosModule/
    // AuditoriaModule transitivamente, ver orquestador.module.ts).
    PatrimonialModule,
    OrquestadorModule,
    // Fase 6 (ROADMAP.md, cip/aidlc-docs/): dispatcher que publica eventos_outbox hacia la cola
    // pg-boss (ADR-005) que consumirá el worker de CIP — CORE no depende de CIP para responder al
    // usuario (ver DOC-014 8, reconciliación con Tomo IV 2.15/2.19).
    EventosOutboxModule,
    // DOC-021 4 (Administrador del Sistema) — conteos de plataforma, sin OrquestadorService (solo
    // lectura, sin auditoria).
    IndicadoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { QrConnectorModule } from './qr-connector/qr-connector.module';
import { AdministradorModule } from './administrador/administrador.module';
import { DirectivoModule } from './directivo/directivo.module';
import { DashboardConnectorModule } from './dashboard-connector/dashboard-connector.module';
import { ZitadelAuthModule } from './common/auth/zitadel-auth.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { CorrelationIdMiddleware } from './common/correlation-id/correlation-id.middleware';
import { MetricsModule } from './common/metrics/metrics.module';

@Module({
  imports: [
    // GET /metrics -- formato Prometheus (prom-client), protegido por METRICS_TOKEN cuando esta
    // configurado (siempre en devops/prod/, opcional en devops/local/) -- ver
    // common/metrics/metrics-token.guard.ts y devops/prod/README.md "Hallazgo real".
    MetricsModule,
    ZitadelAuthModule,
    RateLimitModule,
    HealthModule,
    QrConnectorModule,
    AdministradorModule,
    DirectivoModule,
    DashboardConnectorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

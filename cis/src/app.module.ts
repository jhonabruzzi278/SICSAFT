import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
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

@Module({
  imports: [
    // GET /metrics -- formato Prometheus (prom-client), target real en observability/prometheus.yml.
    // OJO: a diferencia de core/cip (sin router publico en Traefik), CIS SI tiene uno
    // (api.sicsaft.localhost, sin restriccion de path) -- este endpoint queda publicamente
    // alcanzable tal cual, sin bloqueo a nivel de Traefik todavia. No es un problema hoy (dominio
    // .localhost, sin exposicion real), pero antes de que este mismo patron se replique en
    // devops/prod/ hace falta una regla que bloquee /metrics desde afuera (ipAllowList o un
    // router de mayor prioridad), ver conversacion de esta sesion.
    PrometheusModule.register(),
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

import { Global, Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { loadMetricsConfig } from './metrics.config';
import { METRICS_CONFIG } from './metrics.constants';
import { MetricsController } from './metrics.controller';
import { MetricsTokenGuard } from './metrics-token.guard';

// GET /metrics -- formato Prometheus (prom-client), target real en
// devops/*/observability/prometheus.yml. Protegido por MetricsTokenGuard cuando METRICS_TOKEN
// esta configurado (siempre en devops/prod/, opcional en devops/local/) -- ver
// metrics-token.guard.ts y devops/prod/README.md "Hallazgo real": a diferencia de core/cip (sin
// router publico en Traefik/Coolify), CIS si tiene uno, asi que este endpoint quedaba
// publicamente alcanzable sin este guard.
//
// @Global(): PrometheusModule.register() registra MetricsController como controller de SU
// PROPIO modulo dinamico, no del nuestro -- sin @Global() acá, el guard de ese controller no
// puede resolver METRICS_CONFIG (verificado real: Nest tira "can't resolve dependencies of
// MetricsTokenGuard... Symbol(METRICS_CONFIG)... is available in the PrometheusModule module"
// sin esto, mismo motivo por el que ZitadelAuthModule/ServiceTokenModule ya son @Global()).
@Global()
@Module({
  imports: [PrometheusModule.register({ controller: MetricsController })],
  providers: [
    {
      provide: METRICS_CONFIG,
      useFactory: loadMetricsConfig,
    },
    MetricsTokenGuard,
  ],
  exports: [METRICS_CONFIG, MetricsTokenGuard],
})
export class MetricsModule {}

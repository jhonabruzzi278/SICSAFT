import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { QrConnectorModule } from './qr-connector/qr-connector.module';
import { ZitadelAuthModule } from './common/auth/zitadel-auth.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { CorrelationIdMiddleware } from './common/correlation-id/correlation-id.middleware';

@Module({
  imports: [
    ZitadelAuthModule,
    RateLimitModule,
    HealthModule,
    QrConnectorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

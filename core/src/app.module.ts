import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { ServiceTokenModule } from './common/auth/service-token.module';
import { DatabaseModule } from './database/database.module';
import { CorrelationIdMiddleware } from './common/correlation-id/correlation-id.middleware';

@Module({
  imports: [
    ServiceTokenModule,
    DatabaseModule,
    HealthModule,
    EntitlementsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { ServiceTokenModule } from './common/auth/service-token.module';
import { DatabaseModule } from './database/database.module';
import { CorrelationIdMiddleware } from './common/correlation-id/correlation-id.middleware';
import { PatrimonialModule } from './patrimonial/patrimonial.module';
import { OrquestadorModule } from './orquestador/orquestador.module';

@Module({
  imports: [
    ServiceTokenModule,
    DatabaseModule,
    HealthModule,
    EntitlementsModule,
    // Fase 2 (ROADMAP.md): Motor Patrimonial (GET /catalogo) + Orquestador (POST /inventarios,
    // GET /inventarios/:id/estado — este ultimo trae InventariosModule/EventosModule/
    // AuditoriaModule transitivamente, ver orquestador.module.ts).
    PatrimonialModule,
    OrquestadorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

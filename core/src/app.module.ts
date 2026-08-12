import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { ServiceTokenModule } from './common/auth/service-token.module';

@Module({
  imports: [ServiceTokenModule, HealthModule, EntitlementsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

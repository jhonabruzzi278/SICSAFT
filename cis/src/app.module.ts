import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { QrConnectorModule } from './qr-connector/qr-connector.module';
import { ZitadelAuthModule } from './common/auth/zitadel-auth.module';

@Module({
  imports: [ZitadelAuthModule, HealthModule, QrConnectorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { QrConnectorModule } from './qr-connector/qr-connector.module';

@Module({
  imports: [HealthModule, QrConnectorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

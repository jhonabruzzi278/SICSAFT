import { Module } from '@nestjs/common';
import { QrConnectorController } from './qr-connector.controller';
import { QrConnectorService } from './qr-connector.service';

@Module({
  controllers: [QrConnectorController],
  providers: [QrConnectorService],
})
export class QrConnectorModule {}

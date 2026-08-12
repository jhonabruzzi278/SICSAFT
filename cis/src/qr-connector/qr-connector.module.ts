import { Module } from '@nestjs/common';
import { QrConnectorController } from './qr-connector.controller';
import { QrConnectorService } from './qr-connector.service';
import { CoreClientModule } from '../core-client/core-client.module';

@Module({
  imports: [CoreClientModule],
  controllers: [QrConnectorController],
  providers: [QrConnectorService],
})
export class QrConnectorModule {}

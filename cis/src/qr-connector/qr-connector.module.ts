import { Module } from '@nestjs/common';
import { QrConnectorController } from './qr-connector.controller';
import { QrConnectorService } from './qr-connector.service';
import { CoreClientModule } from '../core-client/core-client.module';
import { DeviceRegistryModule } from '../device-registry/device-registry.module';

@Module({
  imports: [CoreClientModule, DeviceRegistryModule],
  controllers: [QrConnectorController],
  providers: [QrConnectorService],
})
export class QrConnectorModule {}

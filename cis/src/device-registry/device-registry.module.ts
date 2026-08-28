import { Module } from '@nestjs/common';
import { DeviceRegistryService } from './device-registry.service';

@Module({
  providers: [DeviceRegistryService],
  exports: [DeviceRegistryService],
})
export class DeviceRegistryModule {}

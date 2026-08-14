import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { DeviceRegistryService } from './device-registry.service';

@Module({
  imports: [RedisModule],
  providers: [DeviceRegistryService],
  exports: [DeviceRegistryService],
})
export class DeviceRegistryModule {}

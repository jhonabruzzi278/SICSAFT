import { Module } from '@nestjs/common';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { ContratoRepository } from './contrato.repository';

@Module({
  controllers: [EntitlementsController],
  providers: [EntitlementsService, ContratoRepository],
})
export class EntitlementsModule {}

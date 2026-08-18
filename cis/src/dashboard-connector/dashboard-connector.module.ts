import { Module } from '@nestjs/common';
import { DashboardConnectorController } from './dashboard-connector.controller';
import { DashboardConnectorService } from './dashboard-connector.service';
import { CipClientModule } from '../cip-client/cip-client.module';

@Module({
  imports: [CipClientModule],
  controllers: [DashboardConnectorController],
  providers: [DashboardConnectorService],
})
export class DashboardConnectorModule {}

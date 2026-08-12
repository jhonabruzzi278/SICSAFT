import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

export interface ServiceInfo {
  service: string;
  description: string;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getServiceInfo(): ServiceInfo {
    return this.appService.getServiceInfo();
  }
}

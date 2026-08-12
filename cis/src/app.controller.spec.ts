import { Test, TestingModule } from '@nestjs/testing';
import { AppController, ServiceInfo } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getServiceInfo', () => {
    it('returns the CIS service identity', () => {
      const result: ServiceInfo = appController.getServiceInfo();

      expect(result.service).toContain('CIS');
      expect(result.description).toContain('/health');
    });
  });
});

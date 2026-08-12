import { Test, TestingModule } from '@nestjs/testing';
import { QrConnectorModule } from './qr-connector.module';
import { QrConnectorController } from './qr-connector.controller';

describe('QrConnectorModule', () => {
  it('wires QrConnectorController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [QrConnectorModule],
    }).compile();

    expect(module.get(QrConnectorController)).toBeInstanceOf(
      QrConnectorController,
    );
  });
});

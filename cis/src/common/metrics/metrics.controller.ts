import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import type { Response } from 'express';
import { MetricsTokenGuard } from './metrics-token.guard';

// Controller propio en vez de dejar que PrometheusModule registre el suyo -- unica forma
// documentada por la libreria de meterle un guard a GET /metrics (ver
// PrometheusOptions.controller en @willsoto/nestjs-prometheus/dist/interfaces.d.ts).
@Controller()
@UseGuards(MetricsTokenGuard)
export class MetricsController extends PrometheusController {
  @Get()
  index(@Res({ passthrough: true }) response: Response): Promise<string> {
    return super.index(response);
  }
}

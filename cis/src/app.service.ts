import { Injectable } from '@nestjs/common';
import type { ServiceInfo } from './app.controller';

@Injectable()
export class AppService {
  getServiceInfo(): ServiceInfo {
    return {
      service: 'CIS — Centro de Interoperabilidad SICSAFT',
      description:
        'Punto único de entrada entre las fuentes de captura y SICSAFT CORE. Ver /health para estado del servicio.',
    };
  }
}

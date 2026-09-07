import { Injectable } from '@nestjs/common';
import type { ServiceInfo } from './app.controller';

@Injectable()
export class AppService {
  getServiceInfo(): ServiceInfo {
    return {
      service: 'SICSAFT CORE — orquestador + motores',
      description:
        'Único componente autorizado a modificar la BPI (Base Patrimonial Inteligente). Solo habla con el CIS, nunca directo con fuentes de captura. Ver /health para estado del servicio.',
    };
  }
}

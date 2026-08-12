import { Injectable } from '@nestjs/common';
import type { ServiceInfo } from './app.controller';

@Injectable()
export class AppService {
  getServiceInfo(): ServiceInfo {
    return {
      service: 'SICSAFT CORE — orquestador + motores',
      description:
        'Unico componente autorizado a modificar la Base Patrimonial Central. Solo habla con el CIS, nunca directo con fuentes de captura. Ver /health para estado del servicio.',
    };
  }
}

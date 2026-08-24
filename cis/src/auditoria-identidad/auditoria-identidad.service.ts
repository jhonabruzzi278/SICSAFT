import { HttpException, Injectable } from '@nestjs/common';
import { CoreClientService } from '../core-client/core-client.service';

// DOC-024 3 — calco deliberado de OrquestadorService.ejecutarOperacionOficial (core/src/
// orquestador/orquestador.service.ts): ejecuta la accion, reporta el resultado a CORE siempre
// (exito o rechazo), relanza el error tal cual. Existe porque las operaciones de identidad en
// Zitadel (asignar/quitar rol, designar Profesional de AFT) nunca pasan por el Orquestador —
// DOC-021/022 las dejo fuera del Motor de Auditoria de Tomo IV a proposito ("no toca CORE, un
// guard de CIS alcanza"), pero eso dejaba un punto ciego real: nadie quedaba registrado
// asignando o quitando un rol. Este wrapper cierra ese punto ciego sin tocar la autorizacion
// (los guards de CIS siguen cortando exactamente igual antes de llegar acá).
//
// Diferencias deliberadas con ejecutarOperacionOficial (ver DOC-024 3):
// - No audita rechazos de guard: un guard de CIS (AdministradorSistemaGuard/DirectivoGuard) sigue
//   cortando la request ANTES de que el metodo envuelto se ejecute — auditar eso requeriria
//   convertir esos guards al patron DOC-012 8, cambio mas grande y no pedido.
// - No atrapa sus propios fallos de POST /auditoria: si el reporte a CORE falla despues de que la
//   accion ya se ejecuto, el error de auditoria se propaga tal cual (mismo perfil de riesgo que ya
//   acepta AuditoriaRepository.registrar hoy — un fallo ahi tampoco esta especial-cased).
@Injectable()
export class AuditoriaIdentidadService {
  constructor(private readonly coreClientService: CoreClientService) {}

  async ejecutar<T>(
    operacion: string,
    operadorId: string,
    correlationId: string,
    accion: () => Promise<T>,
    opciones: { organizacionId?: string } = {},
  ): Promise<T> {
    try {
      const resultado = await accion();
      await this.coreClientService.postAuditoria(
        {
          usuario: operadorId,
          operacion,
          resultado: 'ok',
          organizacionId: opciones.organizacionId,
        },
        correlationId,
      );
      return resultado;
    } catch (error: unknown) {
      await this.coreClientService.postAuditoria(
        {
          usuario: operadorId,
          operacion,
          resultado: this.resultadoDeError(error),
          organizacionId: opciones.organizacionId,
        },
        correlationId,
      );
      throw error;
    }
  }

  private resultadoDeError(error: unknown): string {
    if (error instanceof HttpException) {
      return `rechazado:${error.getStatus()}`;
    }
    return 'rechazado:error-interno';
  }
}

import { Injectable } from '@nestjs/common';
import type { Contrato } from './contrato.types';
import { SEED_CONTRATOS } from './contrato.seed';
import type { EntitlementsResponse, Organizacion } from './entitlements.types';

@Injectable()
export class EntitlementsService {
  // TODO(DOC-004 §7): sin mapeo operador->organizacion todavia (requiere membership real de
  // Zitadel, que este mock no consume) — cualquier operadorId ve las mismas organizaciones con
  // contrato vigente. `operadorId` se recibe y valida igual porque el contrato de la API ya lo
  // exige (ver core/README.md); queda listo para filtrar en cuanto exista esa fuente de datos.
  resolve(
    operadorId: string,
    ahora: Date = new Date(),
    // Seam de testabilidad: permite ejercitar esVigente() con datos que el seed real no cubre
    // (suspendido, cancelado, vencido) sin tocar el DI de Nest — el controller nunca pasa este
    // tercer argumento, siempre usa SEED_CONTRATOS en producción.
    contratos: readonly Contrato[] = SEED_CONTRATOS,
  ): EntitlementsResponse {
    void operadorId;

    const organizaciones: Organizacion[] = contratos
      .filter((contrato) => this.esVigente(contrato, ahora))
      .filter((contrato) =>
        contrato.modulosContratados.includes('inventario-qr'),
      )
      .map((contrato) => ({
        id: contrato.organizacionId,
        nombre: contrato.organizacionNombre,
        sedes: contrato.sedes,
      }));

    return { organizaciones };
  }

  private esVigente(contrato: Contrato, ahora: Date): boolean {
    // El campo `estado` manda para suspendido/cancelado/vencido-guardado — pero tambien se
    // verifica la fecha para el caso "vencido por tiempo" que este mock nunca escribe de vuelta
    // al campo (no hay cron, ver contrato.types.ts).
    if (contrato.estado !== 'vigente') {
      return false;
    }
    if (ahora < new Date(contrato.vigenciaDesde)) {
      return false;
    }
    if (
      contrato.vigenciaHasta !== null &&
      ahora > new Date(contrato.vigenciaHasta)
    ) {
      return false;
    }
    return true;
  }
}

import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CORE_CLIENT_CONFIG } from './core-client.constants';
import type { CoreClientConfig } from './core-client.config';
import {
  entitlementsResponseSchema,
  type EntitlementsResult,
} from './core-client.types';

// Debe coincidir exactamente con core/src/common/auth/service-token.guard.ts — no hay paquete
// compartido entre CIS y CORE todavia (mismo caso que Organizacion/Sede en core-client.types.ts).
const SERVICE_TOKEN_HEADER = 'x-internal-service-token';

@Injectable()
export class CoreClientService {
  constructor(
    @Inject(CORE_CLIENT_CONFIG) private readonly config: CoreClientConfig,
    private readonly httpService: HttpService,
  ) {}

  async getEntitlements(operadorId: string): Promise<EntitlementsResult> {
    const data = await this.request(operadorId);
    return this.parse(data);
  }

  private async request(operadorId: string): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.config.baseUrl}/entitlements`, {
          params: { operadorId },
          headers: { [SERVICE_TOKEN_HEADER]: this.config.serviceToken },
        }),
      );
      return response.data;
    } catch {
      // DOC-002 §5: 5xx/timeout/sin red es transitorio, no un bug del cliente — se propaga como
      // 502 para que quien llamo a CIS lo trate igual que cualquier otro error transitorio (la
      // causa exacta no se expone, mismo criterio que ZitadelAuthGuard con el 401).
      throw new BadGatewayException({
        message: 'No se pudo resolver entitlements contra CORE',
      });
    }
  }

  private parse(data: unknown): EntitlementsResult {
    const parsed = entitlementsResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadGatewayException({
        message:
          'CORE devolvió una respuesta de entitlements con forma inesperada',
      });
    }
    return parsed.data;
  }
}

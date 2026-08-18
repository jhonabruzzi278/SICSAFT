import { z } from 'zod';
import { loadEnvConfig } from '../common/load-env-config';

// URL base de CIP (ver ../cip/), servicio interno sin ruta de Traefik — solo el CIS le habla,
// mismo criterio que CoreClientConfig (core-client.config.ts). CIP_SERVICE_TOKEN es el secreto
// compartido de auth servicio-a-servicio CIS->CIP (DOC-019 3) — debe ser exactamente el mismo
// valor configurado en CIP (cip/src/common/auth/service-token.config.ts), no un token propio de
// CIS. Ya estaba reservado en .env.example desde DOC-018 3, sin consumidor real hasta este
// módulo.
const cipClientEnvSchema = z.object({
  CIP_URL: z.string().min(1, 'es requerido'),
  CIP_SERVICE_TOKEN: z.string().min(1, 'es requerido'),
});

export interface CipClientConfig {
  baseUrl: string;
  serviceToken: string;
}

export function loadCipClientConfig(
  env: NodeJS.ProcessEnv = process.env,
): CipClientConfig {
  const parsed = loadEnvConfig(cipClientEnvSchema, env, 'CipClient');
  return {
    baseUrl: parsed.CIP_URL,
    serviceToken: parsed.CIP_SERVICE_TOKEN,
  };
}

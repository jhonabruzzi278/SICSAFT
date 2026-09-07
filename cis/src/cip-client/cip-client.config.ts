import { z } from 'zod';
import { loadEnvConfig } from '../common/load-env-config';

// URL base de CIP (ver ../cip/), servicio interno sin ruta de Traefik — solo el CIS le habla,
// mismo criterio que CoreClientConfig (core-client.config.ts). CIP_SERVICE_TOKEN es el secreto
// compartido de auth servicio-a-servicio CIS->CIP (DOC-019 3) — debe ser exactamente el mismo
// valor configurado en CIP (cip/src/common/auth/service-token.config.ts), no un token propio de
// CIS. Ya estaba reservado en .env.example desde DOC-018 3, sin consumidor real hasta este
// módulo.
// CIP-05: En instalaciones Nivel 1 (sin analítica CIP), CIP_URL y CIP_SERVICE_TOKEN son opcionales.
// Si no están configurados, CIS degrada limpiamente sin bloquear el arranque ni requerir el subproceso CIP.
const cipClientEnvSchema = z.object({
  CIP_URL: z.string().optional().default(''),
  CIP_SERVICE_TOKEN: z.string().optional().default(''),
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

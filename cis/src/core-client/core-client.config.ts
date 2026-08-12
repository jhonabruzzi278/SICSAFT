import { z } from 'zod';
import { loadEnvConfig } from '../common/load-env-config';

// URL base de SICSAFT CORE (ver ../core/), servicio interno sin ruta de Traefik — solo el CIS le
// habla, dentro de la red de contenedores (ver devops/local/docker-compose.yml).
// CORE_SERVICE_TOKEN es el secreto compartido de auth servicio-a-servicio CIS->CORE — ver
// core/src/common/auth/service-token.config.ts. Debe ser exactamente el mismo valor configurado
// en CORE, no un token propio de CIS.
const coreClientEnvSchema = z.object({
  CORE_URL: z.string().min(1, 'es requerido'),
  CORE_SERVICE_TOKEN: z.string().min(1, 'es requerido'),
});

export interface CoreClientConfig {
  baseUrl: string;
  serviceToken: string;
}

export function loadCoreClientConfig(
  env: NodeJS.ProcessEnv = process.env,
): CoreClientConfig {
  const parsed = loadEnvConfig(coreClientEnvSchema, env, 'CoreClient');
  return {
    baseUrl: parsed.CORE_URL,
    serviceToken: parsed.CORE_SERVICE_TOKEN,
  };
}

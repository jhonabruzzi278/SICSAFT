import { z } from 'zod';
import { loadEnvConfig } from '../load-env-config';

// Auth servicio-a-servicio CIS->CORE — ver core/README.md "Depende de". Deliberadamente NO usa
// Zitadel: CORE no necesita validar identidad de operador (eso ya lo hizo CIS antes de llamar
// acá), solo necesita confiar en que quien le habla es realmente CIS. Un secreto compartido
// simple alcanza para ese requisito — mTLS/mesh es sobre-ingenieria mientras CORE solo tiene un
// llamador (CIS) dentro de la misma red de contenedores sin exposicion externa.
const serviceTokenEnvSchema = z.object({
  CORE_SERVICE_TOKEN: z.string().min(1, 'es requerido'),
});

export interface ServiceTokenConfig {
  token: string;
}

export function loadServiceTokenConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServiceTokenConfig {
  const parsed = loadEnvConfig(
    serviceTokenEnvSchema,
    env,
    'CORE_SERVICE_TOKEN',
  );
  return { token: parsed.CORE_SERVICE_TOKEN };
}

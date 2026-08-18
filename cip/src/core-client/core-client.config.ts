import { z } from 'zod';

// CIP como cliente de CORE (DOC-018 §3) — mismo secreto compartido que ya usa CIS
// (cis/src/core-client/core-client.config.ts), CIP es un segundo consumidor del mismo contrato
// servicio-a-servicio. `CORE_URL` apunta al servicio `core` dentro de la red de contenedores
// (ver devops/local/docker-compose.yml).
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
  const parsed = coreClientEnvSchema.safeParse(env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración del cliente de CORE inválida: ${detalle}`);
  }

  return {
    baseUrl: parsed.data.CORE_URL,
    serviceToken: parsed.data.CORE_SERVICE_TOKEN,
  };
}

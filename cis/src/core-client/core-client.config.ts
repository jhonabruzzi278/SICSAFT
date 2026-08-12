import { z } from 'zod';

// URL base de SICSAFT CORE (ver ../core/), servicio interno sin ruta de Traefik — solo el CIS le
// habla, dentro de la red de contenedores (ver devops/local/docker-compose.yml).
const coreClientEnvSchema = z.object({
  CORE_URL: z.string().min(1, 'es requerido'),
});

export interface CoreClientConfig {
  baseUrl: string;
}

export function loadCoreClientConfig(
  env: NodeJS.ProcessEnv = process.env,
): CoreClientConfig {
  const parsed = coreClientEnvSchema.safeParse(env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración de CORE_URL inválida: ${detalle}`);
  }

  return { baseUrl: parsed.data.CORE_URL };
}

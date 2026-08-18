import { z } from 'zod';

// Auth servicio-a-servicio hacia la API de lectura de CIP (DOC-018 §3) — mismo mecanismo que
// core/src/common/auth/service-token.config.ts, secreto propio (no reusar CORE_SERVICE_TOKEN):
// cualquier llamador interno del ecosistema que quiera leer el dashboard se autentica con este
// token. Decision provisional hasta que exista un frontend con su propio modelo de auth
// (DOC-014 §7.1).
const serviceTokenEnvSchema = z.object({
  CIP_SERVICE_TOKEN: z.string().min(1, 'es requerido'),
});

export interface ServiceTokenConfig {
  token: string;
}

export function loadServiceTokenConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServiceTokenConfig {
  const parsed = serviceTokenEnvSchema.safeParse(env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración de CIP_SERVICE_TOKEN inválida: ${detalle}`);
  }

  return { token: parsed.data.CIP_SERVICE_TOKEN };
}

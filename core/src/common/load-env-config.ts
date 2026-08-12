import { z } from 'zod';

// Boilerplate compartido por los config loaders de env vars (hoy solo service-token.config.ts) —
// mismo patrón que cis/src/common/load-env-config.ts (sin paquete compartido entre CIS y CORE
// todavía, ver zod-validation.pipe.ts). Parsear con Zod, formatear el error con el campo que
// falló, fallar rápido al arrancar el proceso en vez de con datos a medias en runtime.
export function loadEnvConfig<Schema extends z.ZodObject>(
  schema: Schema,
  env: NodeJS.ProcessEnv,
  label: string,
): z.infer<Schema> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración de ${label} inválida: ${detalle}`);
  }
  return parsed.data;
}

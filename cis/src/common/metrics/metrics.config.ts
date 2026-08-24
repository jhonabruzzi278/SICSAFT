import { z } from 'zod';
import { loadEnvConfig } from '../load-env-config';

// METRICS_TOKEN protege GET /metrics (ver metrics-token.guard.ts) -- a diferencia de
// CORE_SERVICE_TOKEN/CIP_SERVICE_TOKEN, es opcional: sin exposicion real en devops/local/ (CIS
// no tiene ahi nada distinto de un router .localhost, ver el comentario de AppModule), pero
// devops/prod/ si lo necesita porque CIS tiene router publico real. Prometheus lo manda como
// Bearer via bearer_token_file (ver devops/prod/observability/prometheus.yml y
// devops/prod/README.md "Hallazgo real").
const metricsEnvSchema = z.object({
  METRICS_TOKEN: z.string().min(1).optional(),
});

export interface MetricsConfig {
  token: string | undefined;
}

export function loadMetricsConfig(
  env: NodeJS.ProcessEnv = process.env,
): MetricsConfig {
  const parsed = loadEnvConfig(metricsEnvSchema, env, 'Metrics');
  return { token: parsed.METRICS_TOKEN };
}

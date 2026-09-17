import type { CoreHttpExecutor } from './core-client.http-executor';
import {
  entitlementsResponseSchema,
  type EntitlementsResult,
} from './core-client.types';

export async function getEntitlements(
  http: CoreHttpExecutor,
  operadorId: string,
  correlationId: string,
): Promise<EntitlementsResult> {
  const data = await http.get('/entitlements', { operadorId }, correlationId);
  return http.parse(entitlementsResponseSchema, data, 'entitlements');
}

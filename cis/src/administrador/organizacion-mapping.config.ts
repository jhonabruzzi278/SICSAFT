import { z } from 'zod';
import { loadEnvConfig } from '../common/load-env-config';

// DOC-004 §7 / DOC-012 §3 — Zitadel firma `rolesPorOrganizacion` con SU id de organizacion (el
// que aparece en la URL del dashboard, ej. 386029528616558597), pero CORE identifica
// organizaciones con un id de texto legible (ej. 'duoc-uc', ver base-patrimonial/
// DOC-004-modelo-contrato.md §2). Sin este mapeo, un token real de Zitadel nunca podria
// autorizar una escritura oficial: CORE compara `rolesPorOrganizacion[organizacionId]` contra SU
// propio organizacionId, que nunca coincide con la clave que Zitadel firmo. Es el mismo gap que
// ROADMAP.md ya documenta para GET /entitlements ("sin mapeo operador->organizacion real") —
// acá se resuelve el minimo necesario para el camino de ESCRITURA (DOC-012), con un mapeo
// explicito por env (nunca hardcodeado: un id de Zitadel es un dato de la instalacion, no del
// codigo fuente). Formato: JSON `{"<zitadelOrgId>": "<organizacionId-core>"}`.
const organizacionMappingEnvSchema = z.object({
  ZITADEL_ORG_ID_MAP: z
    .string()
    .min(1, 'es requerido (JSON: {"<zitadelOrgId>":"<organizacionId>"})'),
});

export type OrganizacionMapping = Record<string, string>;

export function loadOrganizacionMapping(
  env: NodeJS.ProcessEnv = process.env,
): OrganizacionMapping {
  const parsed = loadEnvConfig(
    organizacionMappingEnvSchema,
    env,
    'OrganizacionMapping',
  );
  let mapping: unknown;
  try {
    mapping = JSON.parse(parsed.ZITADEL_ORG_ID_MAP);
  } catch {
    throw new Error(
      'Configuración de OrganizacionMapping inválida: ZITADEL_ORG_ID_MAP no es JSON válido',
    );
  }
  if (
    typeof mapping !== 'object' ||
    mapping === null ||
    Array.isArray(mapping)
  ) {
    throw new Error(
      'Configuración de OrganizacionMapping inválida: ZITADEL_ORG_ID_MAP debe ser un objeto {zitadelOrgId: organizacionId}',
    );
  }
  for (const value of Object.values(mapping)) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(
        'Configuración de OrganizacionMapping inválida: todos los valores de ZITADEL_ORG_ID_MAP deben ser strings no vacíos',
      );
    }
  }
  return mapping as OrganizacionMapping;
}

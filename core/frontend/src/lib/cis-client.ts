// Cliente HTTP hacia CIS — el portal del Directivo nunca le habla al backend de CORE directo
// (ADR-003, regla no negociable de CLAUDE.md). Reusa POST /auth/session tal cual (WAF 8, "WEB y
// APP QR son clientes intercambiables del mismo contrato") solo para resolver la organización del
// propio Directivo, y consume el módulo nuevo de DOC-022 3 (`cis/src/directivo/`) para designar
// al Profesional de AFT.
import { loadOidcConfig } from './oidc/oidc-config';
import { oidcClient, AuthenticationRequiredError } from './oidc/oidc-client';

export interface Sede {
  id: string;
  nombre: string;
}

export interface Organizacion {
  id: string;
  nombre: string;
  sedes: Sede[];
}

// DOC-022 3 — misma forma que GrantUsuario del lado de CIS (cis/src/zitadel-admin/zitadel-admin.types.ts).
export interface UsuarioOrganizacion {
  userId: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}

// Gap 3 (flujo real Admin->Directivo->Profesional AFT) — misma forma que
// AsignarProfesionalAftResult del lado de CIS (cis/src/directivo/directivo.schemas.ts).
export interface AsignarProfesionalAftResult {
  creado: boolean;
  passwordInicial: string | null;
}

export class CisApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CisApiError';
  }
}

// Un solo deviceId estable por navegador — mismo criterio que ccp/src/lib/cis-client.ts
// (POST /auth/session lo exige por contrato, DOC-002 1, aunque acá no aplica "un solo dispositivo
// por Directivo" como restricción de negocio real).
const DEVICE_ID_KEY = 'core-frontend-sicsaft-device-id';
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `core-frontend-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

async function authorizedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const config = loadOidcConfig();
  const accessToken = await oidcClient.getValidAccessToken();
  const res = await fetch(`${config.cisUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new CisApiError(
      res.status,
      body.message ?? `CIS devolvió ${res.status}`,
    );
  }
  return res;
}

export const cisClient = {
  // POST /auth/session — única forma hoy de resolver la organización del Directivo para el
  // Dashboard (GET /entitlements vive detrás de CORE, sin ruta directa para un navegador; ver
  // core/README.md "TODO(DOC-004 7)" para la limitación conocida de que hoy no filtra por
  // operador — la misma que ya tenía ccp/HubPage.tsx para este mismo propósito).
  async authSession(): Promise<{ organizaciones: Organizacion[] }> {
    const res = await authorizedFetch('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId() }),
    });
    return (await res.json()) as { organizaciones: Organizacion[] };
  },

  // DOC-022 3 — sin organizacionId como parámetro: DirectivoGuard en CIS lo deriva siempre del
  // propio JWT, nunca de lo que mande este cliente.
  async getUsuariosDirectivo(): Promise<UsuarioOrganizacion[]> {
    const res = await authorizedFetch('/directivo/usuarios');
    return (await res.json()) as UsuarioOrganizacion[];
  },

  async asignarProfesionalAft(
    email: string,
  ): Promise<AsignarProfesionalAftResult> {
    const res = await authorizedFetch('/directivo/usuarios', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return (await res.json()) as AsignarProfesionalAftResult;
  },
};

export { AuthenticationRequiredError };

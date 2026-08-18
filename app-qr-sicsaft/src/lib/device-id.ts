// Identificador de dispositivo — persistido en localStorage (no es un secreto, a diferencia del
// access token, ver oidc/token-store.ts). Se manda en POST /auth/session (DOC-002 1, "un solo
// dispositivo por operador") — CIS lo registra y hace supersede del dispositivo anterior si
// cambia, ver cis/src/device-registry/.
const DEVICE_ID_KEY = 'qrvault-device-id';

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

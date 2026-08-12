// Identificador de dispositivo — persistido en localStorage, sin mecanismo
// real de identificación de dispositivo todavía (DOC-002 sección 3, auth
// bloqueada por HANDOFF sección 6). Mismo patrón que operator.ts.
const DEVICE_ID_KEY = 'qrvault-device-id';

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

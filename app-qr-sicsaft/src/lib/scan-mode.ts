// Fase 3.1/DOC-017 1 — selector de modo 1/2/3, puramente informativo (confirmado con el
// usuario): Modo 1/2 llevan al mismo flujo de escaneo, sin cambio de comportamiento. Modo 3
// (RFID) queda deshabilitado hasta Fase 8 — no hay hardware ni backend RFID todavía. La
// selección es una preferencia de UI, no viaja a CIS/CORE (no es parte del contrato DOC-006).
export type ScanMode = 'qr' | 'qr-web' | 'qr-web-rfid';

const STORAGE_KEY = 'qrvault-scan-mode';
const DEFAULT_MODE: ScanMode = 'qr';

export interface ScanModeOption {
  value: ScanMode;
  label: string;
  description: string;
  disabled?: boolean;
}

export const SCAN_MODE_OPTIONS: ScanModeOption[] = [
  { value: 'qr', label: 'Modo 1: QR', description: 'Captura y control con código QR.' },
  {
    value: 'qr-web',
    label: 'Modo 2: QR + WEB',
    description: 'Los datos de este control quedan disponibles en el portal WEB de tu organización.',
  },
  {
    value: 'qr-web-rfid',
    label: 'Modo 3: QR + WEB + RFID',
    description: 'Próximamente — requiere hardware RFID.',
    disabled: true,
  },
];

export function getScanMode(): ScanMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'qr' || stored === 'qr-web' || stored === 'qr-web-rfid') return stored;
  return DEFAULT_MODE;
}

export function setScanMode(mode: ScanMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

// Identificación de operador — persistida en localStorage, sin autenticación
// real (mecanismo real pendiente de definición con SICSAFT CORE, ver
// HANDOFF-APP-QR-SICSAFT.md sección 6, pregunta 2).
const OPERATOR_STORAGE_KEY = 'qrvault-operator';

export function getStoredOperatorName(): string | null {
  return localStorage.getItem(OPERATOR_STORAGE_KEY);
}

export function setStoredOperatorName(name: string): void {
  localStorage.setItem(OPERATOR_STORAGE_KEY, name);
}

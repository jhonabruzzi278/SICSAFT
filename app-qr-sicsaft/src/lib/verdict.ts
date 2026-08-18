// Fase 3.1/DOC-017 §2 — declaración de resultado de sesión, distinta de las 8 categorías de
// escaneo por ítem (DOC-009). Interpretación confirmada con el usuario 2026-08-17:
// EXITOSO: nada falta y nada apareció fuera de área/ubicación.
// ACEPTABLE: exactamente uno de los dos problemas (falta algo, o apareció algo de otra área) —
//            no ambos a la vez.
// DEFECTUOSO: ambos problemas a la vez — control incompleto y contaminado.
export type Verdict = 'exitoso' | 'aceptable' | 'defectuoso';

export function calcularVeredicto(missingCount: number, outOfPlaceCount: number): Verdict {
  const faltan = missingCount > 0;
  const fueraDeArea = outOfPlaceCount > 0;

  if (!faltan && !fueraDeArea) return 'exitoso';
  if (faltan && fueraDeArea) return 'defectuoso';
  return 'aceptable';
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  exitoso: 'Exitoso',
  aceptable: 'Aceptable',
  defectuoso: 'Defectuoso',
};

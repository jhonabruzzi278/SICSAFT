// Fase 3.1/DOC-017 2 — declaración de resultado de sesión, distinta de las 8 categorías de
// escaneo por ítem (DOC-009). Interpretación corregida con el usuario 2026-09-14 (reemplaza la
// versión confirmada 2026-08-17: antes "falta solo" era ACEPTABLE, ahora es DEFECTUOSO):
// EXITOSO: no falta ningún AFT esperado y no apareció ningún AFT de otra área/ubicación.
// ACEPTABLE: no faltan AFT del área, pero aparecieron AFT de otras áreas en la acción de control.
// DEFECTUOSO: faltan AFT — solos, o junto con AFT de otras áreas. Faltar activos es en sí mismo
//             un control defectuoso, haya o no contaminación por AFT de otra área.
export type Verdict = 'exitoso' | 'aceptable' | 'defectuoso';

export function calcularVeredicto(missingCount: number, outOfPlaceCount: number): Verdict {
  const faltan = missingCount > 0;
  const fueraDeArea = outOfPlaceCount > 0;

  if (faltan) return 'defectuoso';
  if (fueraDeArea) return 'aceptable';
  return 'exitoso';
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  exitoso: 'Exitoso',
  aceptable: 'Aceptable',
  defectuoso: 'Defectuoso',
};

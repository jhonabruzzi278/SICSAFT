// DOC-029 RF-I / DOC-017 2 — puerto de la misma regla que app-qr-sicsaft/src/lib/verdict.ts y
// cip/src/agregacion/veredicto.ts (implementación independiente por desplegable, ARCHITECTURE.md
// 5). "EXITOSO" del negocio ("excelente") = `exitoso`.
//
// EXITOSO: nada falta y nada apareció fuera del área/ubicación.
// ACEPTABLE: exactamente uno de los dos problemas (falta algo, o apareció algo de otra área) —
//            no ambos.
// DEFECTUOSO: ambos a la vez → además dispara la auto-auditoría de RF-D 3.
export type Veredicto = 'exitoso' | 'aceptable' | 'defectuoso';

export function calcularVeredicto(
  faltantes: number,
  fueraDeArea: number,
): Veredicto {
  const faltan = faltantes > 0;
  const hayFueraDeArea = fueraDeArea > 0;

  if (!faltan && !hayFueraDeArea) {
    return 'exitoso';
  }
  if (faltan && hayFueraDeArea) {
    return 'defectuoso';
  }
  return 'aceptable';
}

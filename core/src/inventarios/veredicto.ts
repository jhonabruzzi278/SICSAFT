// DOC-029 RF-I / DOC-017 2 — puerto de la misma regla que app-qr-sicsaft/src/lib/verdict.ts y
// cip/src/agregacion/veredicto.ts (implementación independiente por desplegable, ARCHITECTURE.md
// 5). "EXITOSO" del negocio ("excelente") = `exitoso`.
// --
// Regla corregida con el usuario 2026-09-14 (reemplaza la versión anterior: antes "falta solo"
// era ACEPTABLE, ahora es DEFECTUOSO):
// EXITOSO: nada falta y nada apareció fuera del área/ubicación.
// ACEPTABLE: no faltan AFT del área, pero aparecieron AFT de otras áreas en la acción de control.
// DEFECTUOSO: faltan AFT — solos, o junto con AFT de otras áreas → además dispara la
//             auto-auditoría de RF-D 3.
export type Veredicto = 'exitoso' | 'aceptable' | 'defectuoso';

export function calcularVeredicto(
  faltantes: number,
  fueraDeArea: number,
): Veredicto {
  const faltan = faltantes > 0;
  const hayFueraDeArea = fueraDeArea > 0;

  if (faltan) {
    return 'defectuoso';
  }
  if (hayFueraDeArea) {
    return 'aceptable';
  }
  return 'exitoso';
}

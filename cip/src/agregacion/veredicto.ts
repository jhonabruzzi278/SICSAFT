// Puerto de app-qr-sicsaft/src/lib/verdict.ts (Fase 3.1/DOC-017 2) — misma regla, implementacion
// independiente (DOC-018 5, ARCHITECTURE.md 5: no importar codigo entre desplegables, CIP no
// depende de app-qr-sicsaft).
// Regla corregida con el usuario 2026-09-14 (reemplaza la version anterior: antes "falta solo"
// era ACEPTABLE, ahora es DEFECTUOSO):
// EXITOSO: nada falta y nada aparecio fuera de area/ubicacion.
// ACEPTABLE: no faltan AFT del area, pero aparecieron AFT de otras areas en la accion de control.
// DEFECTUOSO: faltan AFT — solos, o junto con AFT de otras areas.
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

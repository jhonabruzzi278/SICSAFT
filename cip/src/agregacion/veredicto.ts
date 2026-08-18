// Puerto de app-qr-sicsaft/src/lib/verdict.ts (Fase 3.1/DOC-017 2) — misma regla, implementacion
// independiente (DOC-018 5, ARCHITECTURE.md 5: no importar codigo entre desplegables, CIP no
// depende de app-qr-sicsaft).
// EXITOSO: nada falta y nada aparecio fuera de area/ubicacion.
// ACEPTABLE: exactamente uno de los dos problemas (falta algo, o aparecio algo de otra area) —
//            no ambos a la vez.
// DEFECTUOSO: ambos problemas a la vez.
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

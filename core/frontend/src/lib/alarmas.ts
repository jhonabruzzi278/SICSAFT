// DOC-037 — derivación de las alarmas del CIP.
//
// Una alarma NO se persiste ni se marca como revisada: se deriva del registro de controles. Por
// cada área se mira su control MÁS RECIENTE; si ese control cerró con veredicto `defectuoso` y
// dejó AFT extraviados, hay alarma. Deja de haberla en cuanto se registra un control posterior en
// esa misma área con veredicto `exitoso` ("Proceso Excelente"). Esa es la única forma de bajarla,
// y es la razón de que no exista un botón de descarte: sin estado que escribir, nadie puede
// silenciar una alarma sin hacer el control real en terreno.

export interface SesionVeredicto {
  sesionId: string;
  areaId: string;
  veredicto: string;
  fechaCierre: string;
}

/**
 * Último control de cada área. Ante `fechaCierre` iguales gana el que venga después en la lista,
 * que es el orden en que los devuelve el CIP.
 */
function ultimaSesionPorArea(
  sesiones: readonly SesionVeredicto[],
): SesionVeredicto[] {
  const ultimas = new Map<string, SesionVeredicto>();
  for (const sesion of sesiones) {
    const previa = ultimas.get(sesion.areaId);
    if (
      !previa ||
      new Date(sesion.fechaCierre).getTime() >=
        new Date(previa.fechaCierre).getTime()
    ) {
      ultimas.set(sesion.areaId, sesion);
    }
  }
  return [...ultimas.values()];
}

/**
 * Áreas cuyo último control fue defectuoso, de la más reciente a la más antigua. Solo
 * `defectuoso` genera alarma: `aceptable` y `exitoso` no.
 */
export function sesionesConAlarma(
  sesiones: readonly SesionVeredicto[],
): SesionVeredicto[] {
  return ultimaSesionPorArea(sesiones)
    .filter((sesion) => sesion.veredicto === 'defectuoso')
    .sort(
      (a, b) =>
        new Date(b.fechaCierre).getTime() - new Date(a.fechaCierre).getTime(),
    );
}

/** "16-09-2026, 5:02:04 p. m." — formato del sello de detección de la alarma. */
export function formatDetectadoEn(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

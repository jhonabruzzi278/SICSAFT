// DOC-029 RF-I / casos-de-uso/CONTRATO-PANTALLA-8.md — presentación del informe de control de
// área. Helpers puros (mapeo veredicto → color/etiqueta, formato de %), testeables aparte del
// componente. El veredicto y sus reglas los calcula CORE (verdict.ts); acá solo se pinta.
import type { VeredictoControl } from './cis-client';

interface EstiloVeredicto {
  /** Fondo de la franja de veredicto — 🟩 verde / 🟨 amarillo / 🟥 rojo. */
  fondo: string;
  /** Texto en mayúsculas del contrato (EXITOSO / ACEPTABLE / DEFECTUOSO). */
  etiqueta: string;
  /** Frase corta de qué significa. */
  detalle: string;
}

const ESTILOS: Record<VeredictoControl, EstiloVeredicto> = {
  exitoso: {
    fondo: 'bg-success/20 text-success ring-1 ring-success/40',
    etiqueta: 'EXITOSO',
    detalle: 'Todos los AFT son del área y se escanearon todos.',
  },
  aceptable: {
    fondo: 'bg-warning/20 text-warning ring-1 ring-warning/40',
    etiqueta: 'ACEPTABLE',
    detalle:
      'Falta escanear algún AFT del área, o apareció alguno de otra área — no ambos.',
  },
  defectuoso: {
    fondo: 'bg-destructive/20 text-destructive ring-1 ring-destructive/40',
    etiqueta: 'DEFECTUOSO',
    detalle: 'Faltan AFT del área y además aparecieron AFT de otras áreas.',
  },
};

export function estiloVeredicto(veredicto: VeredictoControl): EstiloVeredicto {
  return ESTILOS[veredicto];
}

// Fracción 0..1 → "NN,N %" (formato CL). `activosDelArea = 0` llega como 0 desde CORE.
export function formatPorcentaje(fraccion: number): string {
  const pct = Math.max(0, Math.min(1, fraccion)) * 100;
  return `${pct.toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`;
}

// Etiqueta del tipo de AFT en el control (contrato §4): ORDINARIO (solo QR) / EXTRAORDINARIO
// (QR + RFID). `null` = el escaneo no resolvió a un activo real.
export function etiquetaTipo(
  tipo: 'ordinario' | 'extraordinario' | null,
): string {
  if (tipo === 'ordinario') return 'ORDINARIO';
  if (tipo === 'extraordinario') return 'EXTRAORDINARIO';
  return '—';
}

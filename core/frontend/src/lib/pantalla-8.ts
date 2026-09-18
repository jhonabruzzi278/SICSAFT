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

// Regla corregida con el usuario 2026-09-14/15 (reemplaza la version anterior: antes "falta
// solo" era ACEPTABLE, ahora es DEFECTUOSO) — mismo texto que verdict.ts/veredicto.ts.
const ESTILOS: Record<VeredictoControl, EstiloVeredicto> = {
  exitoso: {
    fondo: 'bg-success/20 text-success ring-1 ring-success/40',
    etiqueta: 'EXITOSO',
    detalle:
      'No falta ningún AFT esperado y no apareció ningún AFT de otra área/ubicación.',
  },
  aceptable: {
    fondo: 'bg-warning/20 text-warning ring-1 ring-warning/40',
    etiqueta: 'ACEPTABLE',
    detalle:
      'No faltan AFT del área, pero aparecieron AFT de otras áreas en la acción de control.',
  },
  defectuoso: {
    fondo: 'bg-destructive/20 text-destructive ring-1 ring-destructive/40',
    etiqueta: 'DEFECTUOSO',
    detalle:
      'Faltan AFT del área — solos, o junto con AFT de otras áreas en la acción de control.',
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

// Etiqueta del tipo de AFT en el control (contrato 4): ORDINARIO (solo QR) / EXTRAORDINARIO
// (QR + RFID). `null` = el escaneo no resolvió a un activo real.
export function etiquetaTipo(
  tipo: 'ordinario' | 'extraordinario' | null,
): string {
  if (tipo === 'ordinario') return 'ORDINARIO';
  if (tipo === 'extraordinario') return 'EXTRAORDINARIO';
  return '—';
}

// Hallazgo real 2026-09-16: las cuentas creadas por crearUsuarioHuman (CIS/keycloak-admin.service.ts)
// fuerzan firstName = lastName = email — workaround necesario de un bug distinto de Keycloak 26
// ("Account is not fully set up" si cualquiera queda vacío). Keycloak arma el claim `name`
// concatenando ambos, así que app-qr-sicsaft mandaba literalmente "email email" como operadorId.
// Ya se corrigió en el origen (app-qr-sicsaft/src/lib/oidc/oidc-client.ts prioriza
// preferred_username), pero las sesiones ya grabadas en la BPI mantienen el valor duplicado — este
// helper lo limpia solo en pantalla, sin tocar el dato guardado.
export function nombreOperador(operadorId: string): string {
  const partes = operadorId.trim().split(/\s+/);
  if (partes.length === 2 && partes[0] === partes[1]) return partes[0];
  return operadorId;
}

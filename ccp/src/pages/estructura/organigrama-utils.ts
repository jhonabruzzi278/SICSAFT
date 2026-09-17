import type { Area } from '@/lib/cis-client';

// Antes vivían en lib/etiquetas.ts (compartidas con la hoja de etiquetas QR) — ese módulo se
// extrajo del CCP en la Fase 5 de la reestructuración CCP/CIP (2026-09-13, ver
// herramientas/generador-qr/), así que quedan acá como constantes locales, únicas usuarias ahora.
export const SIN_DIRECCION = 'Sin dirección';
export const SIN_DEPARTAMENTO = 'Sin departamento';

// Acento por dirección — mismo criterio que la paleta de categorías del Resumen Ejecutivo (CIP):
// un color fijo por posición, no por hash del nombre, para que el orden alfabético ya estable de
// `agruparAreasPorDireccion` alcance para que el color de una dirección no salte de sesión a
// sesión. "Sin dirección" no entra en el ciclo — se distingue con un estilo neutro/punteado a
// propósito, ver JerarquiaSection/DireccionesSection.
export const ACENTO_DIRECCION = [
  { borde: 'border-l-blue-500', punto: 'bg-blue-500', texto: 'text-blue-400' },
  {
    borde: 'border-l-emerald-500',
    punto: 'bg-emerald-500',
    texto: 'text-emerald-400',
  },
  {
    borde: 'border-l-amber-500',
    punto: 'bg-amber-500',
    texto: 'text-amber-400',
  },
  {
    borde: 'border-l-purple-500',
    punto: 'bg-purple-500',
    texto: 'text-purple-400',
  },
  { borde: 'border-l-sky-500', punto: 'bg-sky-500', texto: 'text-sky-400' },
] as const;

export function agruparAreasPorDireccion(areas: Area[] | null) {
  const grupos = new Map<string, Area[]>();
  for (const area of areas ?? []) {
    const direccion = area.dependencia?.trim() || SIN_DIRECCION;
    const lista = grupos.get(direccion) ?? [];
    lista.push(area);
    grupos.set(direccion, lista);
  }
  return Array.from(grupos.entries()).sort(([a], [b]) =>
    a === SIN_DIRECCION
      ? 1
      : b === SIN_DIRECCION
        ? -1
        : a.localeCompare(b, 'es'),
  );
}

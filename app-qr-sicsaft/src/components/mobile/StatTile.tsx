import type { ReactNode } from 'react';

type Tone = 'default' | 'brand' | 'success' | 'warning' | 'destructive';

type Props = {
  value: ReactNode;
  label: ReactNode;
  /** Color del número. Semántico, no decorativo (ver BRAND.md). */
  tone?: Tone;
  /** Va en el <span> que contiene SÓLO el valor — la suite e2e hace toHaveText sobre él. */
  valueTestId?: string;
  /** Icono opcional arriba a la izquierda. */
  icon?: ReactNode;
};

const TONE_CLASS: Record<Tone, string> = {
  default: 'text-foreground',
  brand: 'text-brand',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

/** Tarjeta de métrica: número grande + etiqueta. Usada en el reporte de control y en el catálogo. */
export function StatTile({ value, label, tone = 'default', valueTestId, icon }: Props) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-elev-1">
      {icon && <span className="mb-1 text-muted-foreground">{icon}</span>}
      <span
        data-testid={valueTestId}
        className={`text-2xl leading-none font-bold tabular-nums ${TONE_CLASS[tone]}`}
      >
        {value}
      </span>
      <span className="mt-1.5 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

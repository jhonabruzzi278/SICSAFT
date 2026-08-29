import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'destructive';

type Props = {
  children: ReactNode;
  tone?: Tone;
  'data-testid'?: string;
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
};

/** Chip de estado (Finalizado / Pendiente / Rechazado...), estilo lista del mockup de referencia. */
export function StatusPill({ children, tone = 'neutral', ...rest }: Props) {
  return (
    <span
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

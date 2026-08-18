import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';

// Primitivos minimos de UI (sin radix/shadcn — ver ccp/README.md "Decisiones de esta primera
// version" para por que). Foco visible via :focus-visible en index.css (RNF-05).

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-bg hover:bg-accent-strong',
    secondary:
      'border border-border bg-bg-raised text-text hover:border-border-strong',
    ghost: 'text-text-dim hover:text-text',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-bg-card p-6 ${className}`}>{children}</div>
  );
}

export function Label({ className = '', ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block text-sm font-medium text-text-dim ${className}`}
      {...rest}
    />
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent ${className}`}
      {...rest}
    />
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-destructive">{children}</p>;
}

// RNF-05 — contraste AA verificado con canvas.getImageData (compositing real de la opacidad
// contra --color-bg-card, no solo el color base): success/warning/destructive dan 5.1-6.7:1. La
// variante original de `vencido`/fallback (bg-text-faint/15 text-text-faint) daba 3.50:1, por
// debajo del minimo AA de 4.5:1 para texto normal — corregida a text-dim (6.64:1).
const BADGE_STYLES: Record<string, string> = {
  vigente: 'bg-success/15 text-success',
  activo: 'bg-success/15 text-success',
  suspendido: 'bg-warning/15 text-warning',
  vencido: 'bg-text-dim/15 text-text-dim',
  cancelado: 'bg-destructive/15 text-destructive',
  dado_de_baja: 'bg-destructive/15 text-destructive',
};

export function Badge({ children }: { children: string }) {
  const style = BADGE_STYLES[children] ?? 'bg-text-dim/15 text-text-dim';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {children}
    </span>
  );
}

export function Alert({
  variant = 'error',
  children,
}: {
  variant?: 'error' | 'success';
  children: ReactNode;
}) {
  const styles =
    variant === 'error'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : 'border-success/40 bg-success/10 text-success';
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

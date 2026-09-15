import { useEffect } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';

// Primitivos minimos de UI (sin radix/shadcn — mismo criterio que ccp/README.md "Decisiones de
// esta primera version"). Foco visible via :focus-visible en index.css (RNF-05).

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-bg shadow-elev-float hover:bg-accent-strong',
    secondary:
      'border border-border bg-bg-raised text-text hover:border-border-strong hover:bg-bg-card',
    ghost: 'text-text-dim hover:bg-bg-card hover:text-text',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest} />
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-bg-card p-6 shadow-elev-1 ${className}`}
    >
      {children}
    </div>
  );
}

export function Label({
  className = '',
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block text-sm font-medium text-text-dim ${className}`}
      {...rest}
    />
  );
}

export function Input({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text transition-colors outline-none placeholder:text-text-faint focus:border-accent focus:ring-2 focus:ring-accent/25 ${className}`}
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

export function Badge({
  children,
  className = '',
  variant,
}: {
  children: ReactNode;
  className?: string;
  variant?: 'success' | 'warning' | 'error';
}) {
  let style = 'bg-text-dim/15 text-text-dim';
  if (variant === 'success') style = 'bg-success/15 text-success';
  else if (variant === 'warning') style = 'bg-warning/15 text-warning';
  else if (variant === 'error') style = 'bg-destructive/15 text-destructive';
  else if (typeof children === 'string' && BADGE_STYLES[children]) {
    style = BADGE_STYLES[children];
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      {children}
    </span>
  );
}

// Modal minimo (sin radix/shadcn, mismo criterio que el resto de este archivo): overlay +
// panel centrado, cierra con Escape o click afuera. `role="dialog"` + `aria-modal` para lectores
// de pantalla; el foco no se atrapa dentro a propósito (alcance mínimo viable, ver ccp/README.md
// "Decisiones de esta primera version" para el mismo criterio en otros primitivos).
export function Modal({
  open,
  onClose,
  children,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  // Cierra solo si el click cayó justo en el fondo (target === currentTarget), no en el panel ni
  // en su contenido — más robusto que un stopPropagation() en el panel. typescript:S1082 pide que
  // todo elemento con onClick tenga también un listener de teclado: el de acá es redundante con
  // el Escape global de arriba, pero satisface la regla explícitamente en el mismo elemento en
  // vez de depender de una regla de excepción por role="presentation".
  function onFondoClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 p-4 py-10 backdrop-blur-sm sm:items-center"
      onClick={onFondoClick}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full max-w-3xl rounded-2xl border border-border bg-bg-card shadow-2xl ${className}`}
      >
        {children}
      </div>
    </div>
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
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

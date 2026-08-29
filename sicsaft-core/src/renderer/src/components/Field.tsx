import type { InputHTMLAttributes, ReactNode, Ref } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** React 19: `ref` como prop normal — lo necesita `react-hook-form` con `{...register(...)}`. */
  ref?: Ref<HTMLInputElement>;
};

/**
 * Campo de formulario del wizard: label + input + error/hint, con estilo
 * consistente (foco con anillo del acento). Reemplaza el `<label>/<input>`
 * copiado en PasoDatosCliente/Director/ProfesionalAft.
 */
export function Field({
  label,
  error,
  hint,
  id,
  className,
  ref,
  ...rest
}: Props) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        className={
          "w-full rounded-[var(--radius)] border bg-[var(--input)] px-3 py-2 text-card-foreground outline-none transition-colors placeholder:text-[var(--faint-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 " +
          (error ? "border-[var(--destructive)] " : "border-[var(--border)] ") +
          (className ?? "")
        }
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-[var(--destructive)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--faint-foreground)]">{hint}</p>
      ) : null}
    </div>
  );
}

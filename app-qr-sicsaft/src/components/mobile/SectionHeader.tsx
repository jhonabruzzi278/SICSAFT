import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Enlace o acción a la derecha (p. ej. "Ver todo"). */
  action?: ReactNode;
};

/** Rótulo de sección, estilo "Accesos rápidos" del mockup de referencia. */
export function SectionHeader({ children, action }: Props) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

import type { ReactNode } from 'react';

type Props = {
  /** Título de la pantalla (opcional: algunas vistas traen su propio header). */
  title?: string;
  /** Texto secundario bajo el título. */
  subtitle?: ReactNode;
  /** Acción a la derecha del título (botón, toggle...). */
  action?: ReactNode;
  children: ReactNode;
};

/**
 * Contenedor de pantalla del shell móvil: header opcional (título + subtítulo +
 * acción) y cuerpo con ritmo de espaciado consistente. El padding lateral y el
 * espacio para la bottom nav los pone AppShell; acá sólo el layout interno.
 */
export function Screen({ title, subtitle, action, children }: Props) {
  return (
    <div className="space-y-4">
      {(title || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h1 className="font-heading text-xl font-bold tracking-tight">{title}</h1>}
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

import type { ReactNode } from 'react';

type Props = {
  /** Nombre del operador con sesión activa, si lo hay. */
  operatorName?: string | null;
  /** Acciones a la derecha (tema, logout, ...). */
  actions?: ReactNode;
};

/**
 * Barra superior del shell móvil: marca SICSAFT + saludo al operador + acciones.
 * Fondo azul degradado (`--appbar-grad`, ver index.css) en el mismo espíritu que
 * el mockup de referencia. Fija arriba; el contenido reserva su alto con
 * `pt-[var(--appbar-h)]` en AppShell.
 */
export function AppBar({ operatorName, actions }: Props) {
  const greeting = operatorName ? primerNombre(operatorName) : null;

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 flex h-[var(--appbar-h)] items-center gap-3 px-4 text-white shadow-elev-2"
      style={{ background: 'var(--appbar-grad)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex min-w-0 flex-1 flex-col leading-none">
        <span className="font-heading text-base font-bold tracking-[0.2em] uppercase">SICSAFT</span>
        {greeting ? (
          <span className="mt-0.5 truncate text-xs text-white/75">Hola, {greeting}</span>
        ) : (
          <span className="mt-0.5 text-xs text-white/60">Control de inventario</span>
        )}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </header>
  );
}

function primerNombre(nombre: string): string {
  const limpio = nombre.trim().split(/\s+/)[0] ?? nombre;
  return limpio.length > 18 ? `${limpio.slice(0, 17)}…` : limpio;
}

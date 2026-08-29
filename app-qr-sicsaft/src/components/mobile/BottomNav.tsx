import { NavLink } from 'react-router-dom';
import { HistoryIcon, PackageIcon, ScanLineIcon } from 'lucide-react';

type NavItem = {
  to: string;
  label: string;
  icon: typeof ScanLineIcon;
  testId: string;
  /** El tab primario (Escanear) va centrado y realzado, estilo FAB. */
  primary?: boolean;
};

const ITEMS: NavItem[] = [
  { to: '/history', label: 'Historial', icon: HistoryIcon, testId: 'nav-history' },
  { to: '/', label: 'Escanear', icon: ScanLineIcon, testId: 'nav-scan', primary: true },
  { to: '/catalog', label: 'Catálogo', icon: PackageIcon, testId: 'nav-catalog' },
];

/**
 * Bottom nav fija del shell móvil. Reemplaza al sidebar de escritorio: siempre
 * visible, sin trigger. El tab "Escanear" va centrado y elevado (acción
 * primaria de la app). Mantiene los data-testid `nav-history/nav-scan/nav-catalog`
 * que usa la suite e2e.
 */
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[var(--bottomnav-h)] max-w-[var(--shell-max-w)] items-stretch justify-around border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {ITEMS.map(({ to, label, icon: Icon, testId, primary }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          data-testid={testId}
          className="group relative flex flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-muted-foreground transition-colors aria-[current=page]:text-primary"
        >
          {primary ? (
            <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elev-float ring-4 ring-background transition-transform group-active:scale-95 group-aria-[current=page]:bg-primary">
              <Icon className="size-6" />
            </span>
          ) : (
            <Icon className="size-5" />
          )}
          <span className={primary ? 'mt-0.5' : ''}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

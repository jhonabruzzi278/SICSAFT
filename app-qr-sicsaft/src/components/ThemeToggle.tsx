import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * Toggle de tema como botón de ícono para la app bar (ícono blanco sobre el
 * degradado azul). Antes era un SidebarMenuButton; el shell móvil no tiene
 * sidebar. Mantiene el data-testid `theme-toggle` que usa la suite e2e.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      disabled={!mounted}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="flex size-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 active:bg-white/25 disabled:opacity-50"
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { SidebarMenuButton } from '@/components/ui/sidebar';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <SidebarMenuButton disabled>Tema</SidebarMenuButton>;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <SidebarMenuButton
      data-testid="theme-toggle"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      tooltip={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      {isDark ? <Sun /> : <Moon />}
      <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
    </SidebarMenuButton>
  );
}

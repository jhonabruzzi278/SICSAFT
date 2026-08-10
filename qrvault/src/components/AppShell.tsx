import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PackageIcon, HistoryIcon, ScanLineIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV_ITEMS = [
  { to: '/', label: 'Escanear', icon: ScanLineIcon, end: true },
  { to: '/history', label: 'Historial', icon: HistoryIcon, end: true },
  { to: '/catalog', label: 'Catálogo', icon: PackageIcon, end: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-2">
              <span className="font-heading text-xl font-bold tracking-widest uppercase">
                APP QR SICSAFT
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Panel de inventario</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.label}>
                        <NavLink to={item.to} data-testid={`nav-${item.to === '/' ? 'scan' : item.to.slice(1)}`}>
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <ThemeToggle />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
            <SidebarTrigger data-testid="sidebar-trigger" />
            <span className="font-heading text-lg font-bold tracking-widest uppercase">APP QR SICSAFT</span>
          </header>
          <div className="flex-1 p-4 md:p-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

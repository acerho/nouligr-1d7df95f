import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings, 
  Bell,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useTranslation } from '@/hooks/useTranslation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { settings } = usePracticeSettings();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navigation = [
    { name: t.nav.dashboard, href: '/dashboard', icon: LayoutDashboard },
    { name: t.nav.patients, href: '/patients', icon: Users },
    { name: t.nav.appointments, href: '/appointments', icon: Calendar },
    { name: t.nav.notifications, href: '/notifications', icon: Bell },
    { name: t.nav.settings, href: '/settings', icon: Settings },
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo/Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        {settings?.logo_url ? (
          <img 
            src={settings.logo_url} 
            alt="Practice Logo" 
            className="h-8 w-8 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">M</span>
          </div>
        )}
        <div className="flex flex-col">
          <span className="font-display text-sm font-semibold text-sidebar-foreground">
            {settings?.practice_name || 'Medical Office'}
          </span>
          <span className="text-xs text-muted-foreground">
            {settings?.specialty || 'Healthcare'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
          
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className={cn(
                'h-5 w-5',
                isActive ? 'text-sidebar-primary' : 'text-muted-foreground'
              )} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          {t.nav.signOut}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background px-4 md:hidden">
        <div className="flex items-center gap-3">
          {settings?.logo_url ? (
            <img 
              src={settings.logo_url} 
              alt="Practice Logo" 
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">M</span>
            </div>
          )}
          <span className="font-display text-sm font-semibold text-foreground">
            {settings?.practice_name || 'Medical Office'}
          </span>
        </div>
        
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-sidebar p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-sidebar-border bg-sidebar md:block">
        <SidebarContent />
      </aside>
    </>
  );
}

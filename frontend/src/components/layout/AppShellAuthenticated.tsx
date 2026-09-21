/**
 * Location: src/components/layout/AppShellAuthenticated.tsx
 * Purpose: Render the authenticated app shell using backend-driven navigation context.
 * Why: Removes hardcoded role navigation while preserving existing shell behavior and UX.
 */

import { type ReactNode, useEffect, useState } from 'react';
import { BookOpen, Bell, GraduationCap, Info, LogOut, Menu, Settings, User } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@components/ui/sheet';
import { toast } from 'sonner@2.0.3';
import { Avatar, AvatarFallback } from '@components/ui/avatar';
import { Button } from '@components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { useNavigationContext } from '@features/navigation';
import { NavigationItem as NavigationItemRow } from '@features/navigation/components/NavigationItem';
import { getProfileInitials } from '@features/profile/profileInitials';
import { useRouter } from '@lib/router';
import { useAuthStore } from '@store/authStore';

import { getBadgeCountForSource, resolveProfilePath } from './appShell.helpers';

type AppShellAuthenticatedProps = {
  children: ReactNode;
};

export function AppShellAuthenticated({ children }: AppShellAuthenticatedProps) {
  const { currentUser, logout } = useAuthStore();
  const { currentPath, navigate } = useRouter();
  const { items, badgeCounts, source, error, isLoading, refetch } = useNavigationContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const resolvedProfilePath = resolveProfilePath(currentUser.role);
  const profileItem = resolvedProfilePath
    ? items.find((item) => item.path === resolvedProfilePath)
    : null;
  const notificationItem = items.find((item) => item.badgeSource === 'notifications') ?? null;
  const settingsItem = items.find((item) => item.path === '/settings') ?? null;

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    if (source !== 'live') {
      console.info(`[navigation] Using "${source}" source in authenticated shell.`);
    }
  }, [source]);

  useEffect(() => {
    if (!import.meta.env.DEV || !error) {
      return;
    }

    console.warn('[navigation] AppShell navigation sync issue.', {
      source,
      message: error.message,
    });
  }, [error, source]);

  const handleNavClick = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    void logout().catch(() => {
      toast.error('Server logout could not be confirmed.', {
        description: 'Retry to prevent the session from being restored.',
        action: { label: 'Retry', onClick: handleLogout },
      });
    });
  };

  const navigation = (
    <nav aria-label="Workspace" className="flex-1 p-3 space-y-1 overflow-y-auto">
      {isLoading && items.length === 0 && <p role="status">Loading navigation...</p>}
      {!isLoading && error && <div role="alert" className="space-y-3 p-2">
        <p>{source === 'unavailable' ? 'Navigation is unavailable.' : 'Navigation counts are unavailable.'}</p>
        <Button variant="outline" onClick={() => void refetch()}>Retry navigation</Button>
      </div>}
      {source !== 'unavailable' && items.map((item) => <NavigationItemRow
        key={item.id} item={item} isActive={currentPath === item.path}
        count={getBadgeCountForSource(item.badgeSource, badgeCounts)} onClick={handleNavClick}
      />)}
      {!isLoading && source !== 'unavailable' && items.length === 0 &&
        <p>No navigation items are available for this account.</p>}
    </nav>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-16 border-b bg-card/90 backdrop-blur flex items-center px-4 gap-4 sticky top-0 z-50">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild><Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open workspace navigation"
        >
          <Menu className="size-5" />
        </Button></SheetTrigger>
        <SheetContent side="left" className="w-64">
          <SheetTitle className="px-4 pt-4">Workspace navigation</SheetTitle>
          <SheetDescription className="sr-only">Choose a page in your workspace.</SheetDescription>
          {navigation}
        </SheetContent>
        </Sheet>

        <button aria-label="NCE" onClick={() => navigate('/')} className="flex items-center gap-2" type="button">
          <div className="brand-mark size-8">
            <GraduationCap className="size-5" />
          </div>
          <span className="font-semibold hidden sm:inline tracking-normal">NCE</span>
        </button>

        <div className="flex-1" />

        {(currentUser.role === 'student' || currentUser.role === 'teacher') && notificationItem && (
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Notifications, ${badgeCounts.notifications} unread`}
            onClick={() => navigate(notificationItem.path)}
          >
            <Bell className="size-5" />
            {badgeCounts.notifications > 0 && (
              <span className="absolute -top-1 -right-1 size-5 rounded-full bg-primary text-primary-foreground p-0 flex items-center justify-center text-[10px]">
                {badgeCounts.notifications > 99 ? '99+' : badgeCounts.notifications}
              </span>
            )}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent transition-colors" type="button">
              <Avatar className="size-8">
                <AvatarFallback>{getProfileInitials(currentUser.name)}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm">{currentUser.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{currentUser.role}</span>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {profileItem && (
              <DropdownMenuItem onClick={() => navigate(profileItem.path)}>
                <User className="mr-2 size-4" />
                Profile
              </DropdownMenuItem>
            )}

            {settingsItem && (
              <DropdownMenuItem onClick={() => navigate(settingsItem.path)}>
                <Settings className="mr-2 size-4" />
                Settings
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/about')}>
              <Info className="mr-2 size-4" />
              About
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/courses')}>
              <BookOpen className="mr-2 size-4" />
              Browse Courses
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className="hidden md:flex w-64 border-r bg-sidebar flex-col"
        >
          {navigation}
        </aside>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/**
 * Location: src/components/layout/AppShellAuthenticated.tsx
 * Purpose: Render the authenticated app shell using backend-driven navigation context.
 * Why: Removes hardcoded role navigation while preserving existing shell behavior and UX.
 */

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { BookOpen, Bell, GraduationCap, Info, LogOut, Menu, Settings, User, X } from 'lucide-react';
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
import { clearBadgeCache, clearNavigationCache } from '@features/navigation/utils/cache';
import { ENABLE_DEV_AUTH_FALLBACK } from '@lib/constants';
import { type Role } from '@lib/mock-data';
import { useRouter } from '@lib/router';
import { useAuthStore } from '@store/authStore';

import { DASHBOARD_PATH_BY_ROLE, getBadgeCountForSource, resolveProfilePath } from './appShell.helpers';

type AppShellAuthenticatedProps = {
  children: ReactNode;
};

function RoleSwitcher({ currentRole }: { currentRole: Role }) {
  const { switchRole } = useAuthStore();
  const { navigate } = useRouter();

  const handleRoleSwitch = (role: Role) => {
    if (role === 'public') {
      return;
    }

    switchRole(role);
    navigate(DASHBOARD_PATH_BY_ROLE[role]);
  };

  return (
    <div className="flex gap-1">
      {(['student', 'teacher', 'admin'] as Role[]).map((role) => (
        <Button
          key={role}
          variant={currentRole === role ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleRoleSwitch(role)}
          className="flex-1 text-xs capitalize"
        >
          {role[0].toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

export function AppShellAuthenticated({ children }: AppShellAuthenticatedProps) {
  const { currentUser, logout, authMode } = useAuthStore();
  const { currentPath, navigate } = useRouter();
  const { items, badgeCounts, source, error } = useNavigationContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showRoleSwitcher = ENABLE_DEV_AUTH_FALLBACK && authMode === 'persona';
  const profilePath = resolveProfilePath(currentUser.role);

  const notificationPath = useMemo(
    () => items.find((item) => item.badgeSource === 'notifications')?.path ?? '/student/notifications',
    [items],
  );

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

  const clearCurrentUserNavigationCache = () => {
    if (currentUser.role === 'public') {
      return;
    }

    const cacheIdentity = {
      userId: currentUser.id,
      role: currentUser.role,
    };

    clearNavigationCache(cacheIdentity);
    clearBadgeCache(cacheIdentity);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    clearCurrentUserNavigationCache();
    void logout();
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-16 border-b bg-card flex items-center px-4 gap-4 sticky top-0 z-50">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        <button onClick={() => navigate('/')} className="flex items-center gap-2" type="button">
          <div className="size-8 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center">
            <GraduationCap className="size-5 text-primary" />
          </div>
          <span className="font-medium hidden sm:inline">NCE</span>
        </button>

        <div className="flex-1" />

        {currentUser.role === 'student' && (
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate(notificationPath)}
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
                <AvatarFallback>{currentUser.name.substring(0, 2).toUpperCase()}</AvatarFallback>
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

            {profilePath && (
              <DropdownMenuItem onClick={() => navigate(profilePath)}>
                <User className="mr-2 size-4" />
                Profile
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 size-4" />
              Settings
            </DropdownMenuItem>

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
          className={[
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            'md:translate-x-0 fixed md:relative inset-y-0 left-0 z-40',
            'w-64 border-r bg-card transition-transform duration-200 ease-in-out',
            'flex flex-col mt-16 md:mt-0',
          ].join(' ')}
        >
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {items.map((item) => (
              <NavigationItemRow
                key={item.id}
                item={item}
                isActive={currentPath === item.path}
                count={getBadgeCountForSource(item.badgeSource, badgeCounts)}
                onClick={handleNavClick}
              />
            ))}

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground px-2 py-3">
                No navigation items are available for this account.
              </p>
            )}
          </nav>

          {showRoleSwitcher && (
            <div className="p-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Demo: Switch Role</p>
              <RoleSwitcher currentRole={currentUser.role} />
            </div>
          )}
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/**
 * Location: src/components/layout/AppShellPublic.tsx
 * Purpose: Render the marketing/public shell and top navigation.
 * Why: Keeps public layout behavior isolated from authenticated navigation concerns.
 */

import type { ReactNode } from 'react';
import { BookOpen, GraduationCap, LayoutDashboard, LogOut, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@components/ui/avatar';
import { Button } from '@components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { getFallbackNavigation } from '@features/navigation/utils/fallbackNav';
import { getIcon } from '@features/navigation/utils/iconMap';
import { clearBadgeCache, clearNavigationCache } from '@features/navigation/utils/cache';
import { useRouter } from '@lib/router';
import { useAuthStore } from '@store/authStore';

import { DASHBOARD_PATH_BY_ROLE, resolveProfilePath } from './appShell.helpers';

type AppShellPublicProps = {
  children: ReactNode;
};

export function AppShellPublic({ children }: AppShellPublicProps) {
  const { currentUser, isAuthenticated, logout } = useAuthStore();
  const { currentPath, navigate } = useRouter();

  const isLoggedIn = isAuthenticated && currentUser.role !== 'public';
  const dashboardPath = DASHBOARD_PATH_BY_ROLE[currentUser.role];
  const profilePath = resolveProfilePath(currentUser.role);
  const publicNavigationItems = getFallbackNavigation('public').items;

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

  const handleLogout = () => {
    clearCurrentUserNavigationCache();
    void logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <nav className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <button onClick={() => navigate('/')} className="flex items-center gap-2" type="button">
                <div className="size-8 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center">
                  <GraduationCap className="size-5 text-primary" />
                </div>
                <span className="font-medium">NCE</span>
              </button>
              <div className="hidden md:flex items-center gap-1">
                {publicNavigationItems.map((item) => {
                  const Icon = getIcon(item.iconName);

                  return (
                    <Button
                      key={item.id}
                      variant={currentPath === item.path ? 'secondary' : 'ghost'}
                      onClick={() => navigate(item.path)}
                      className="gap-2"
                    >
                      <Icon className="size-5" />
                      {item.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Open account menu"
                      className="rounded-full p-1 hover:bg-accent transition-colors"
                    >
                      <Avatar className="size-9">
                        <AvatarFallback>
                          {currentUser.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate(dashboardPath)}>
                      <LayoutDashboard className="mr-2 size-4" />
                      Dashboard
                    </DropdownMenuItem>

                    {profilePath && (
                      <DropdownMenuItem onClick={() => navigate(profilePath)}>
                        <User className="mr-2 size-4" />
                        Profile
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 size-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/login')}>
                    Login
                  </Button>
                  <Button onClick={() => navigate('/login')}>Get Started</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-muted/30 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="size-8 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center">
                  <GraduationCap className="size-5 text-primary" />
                </div>
                <span className="font-medium">NCE</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Empowering students and teachers with modern educational tools.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-4">Platform</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => navigate('/courses')}>Courses</button></li>
                <li><button>For Teachers</button></li>
                <li><button>For Students</button></li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => navigate('/about')}>About</button></li>
                <li><button onClick={() => navigate('/contact')}>Contact</button></li>
                <li><button>Privacy</button></li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button>Help Center</button></li>
                <li><button>Documentation</button></li>
                <li><button>Status</button></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            {`© ${new Date().getFullYear()} NCE. All rights reserved.`}
          </div>
        </div>
      </footer>
    </div>
  );
}

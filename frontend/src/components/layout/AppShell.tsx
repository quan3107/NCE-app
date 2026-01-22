/**
 * Location: components/layout/AppShell.tsx
 * Purpose: Render the App Shell component within the Layout layer.
 * Why: Supports reuse under the refactored frontend structure.
 */

import { ReactNode, useState } from 'react';
import { Role } from '@lib/mock-data';
import { useUserNotifications } from '@features/notifications/api';
import { ENABLE_DEV_AUTH_FALLBACK } from '@lib/constants';
import { useRouter } from '@lib/router';
import { useAuthStore } from '@store/authStore';
import {
  Home,
  BookOpen,
  Mail,
  Info,
  LayoutDashboard,
  FileText,
  GraduationCap,
  Bell,
  User,
  Users,
  Settings,
  ScrollText,
  BarChart3,
  Menu,
  X,
  LogOut,
  BookMarked,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@components/ui/avatar';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';

function RoleSwitcher({ currentRole }: { currentRole: Role }) {
  const { switchRole } = useAuthStore();
  const { navigate } = useRouter();

  const handleRoleSwitch = (role: Role) => {
    switchRole(role);
    const basePath = role === 'student' ? '/student/dashboard' : role === 'teacher' ? '/teacher/dashboard' : '/admin/dashboard';
    navigate(basePath);
  };

  return (
    <div className="p-4 border-t bg-muted/30">
      <p className="text-xs text-muted-foreground mb-2">Demo: Switch Role</p>
      <div className="flex gap-1">
        {(['student', 'teacher', 'admin'] as Role[]).map(role => (
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
    </div>
  );
}

type NavItem = {
  label: string;
  path: string;
  icon: ReactNode;
};

type AppShellVariant = 'public' | 'app';

export function AppShell({ children, variant = 'app' }: { children: ReactNode; variant?: AppShellVariant }) {
  const { currentUser, logout, authMode } = useAuthStore();
  const { notifications: userNotifications } = useUserNotifications(currentUser?.id);
  const { currentPath, navigate } = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPublicVariant = variant === 'public';
  const showRoleSwitcher = ENABLE_DEV_AUTH_FALLBACK && authMode === 'persona';

  // Public nav items
  const publicNav: NavItem[] = [
    { label: 'Home', path: '/', icon: <Home className="size-5" /> },
    { label: 'Courses', path: '/courses', icon: <BookOpen className="size-5" /> },
    { label: 'About', path: '/about', icon: <Info className="size-5" /> },
    { label: 'Contact', path: '/contact', icon: <Mail className="size-5" /> },
  ];

  // Student nav items
  const studentNav: NavItem[] = [
    { label: 'Dashboard', path: '/student/dashboard', icon: <LayoutDashboard className="size-5" /> },
    { label: 'Assignments', path: '/student/assignments', icon: <FileText className="size-5" /> },
    { label: 'Grades', path: '/student/grades', icon: <GraduationCap className="size-5" /> },
    { label: 'Notifications', path: '/student/notifications', icon: <Bell className="size-5" /> },
    { label: 'Profile', path: '/student/profile', icon: <User className="size-5" /> },
  ];

  // Teacher nav items
  const teacherNav: NavItem[] = [
    { label: 'Dashboard', path: '/teacher/dashboard', icon: <LayoutDashboard className="size-5" /> },
    { label: 'Courses', path: '/teacher/courses', icon: <BookOpen className="size-5" /> },
    { label: 'Assignments', path: '/teacher/assignments', icon: <FileText className="size-5" /> },
    { label: 'Submissions', path: '/teacher/submissions', icon: <ScrollText className="size-5" /> },
    { label: 'Rubrics', path: '/teacher/rubrics', icon: <BookMarked className="size-5" /> },
    { label: 'Analytics', path: '/teacher/analytics', icon: <BarChart3 className="size-5" /> },
  ];

  // Admin nav items
  const adminNav: NavItem[] = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="size-5" /> },
    { label: 'Users', path: '/admin/users', icon: <Users className="size-5" /> },
    { label: 'Courses', path: '/admin/courses', icon: <BookOpen className="size-5" /> },
    { label: 'Enrollments', path: '/admin/enrollments', icon: <GraduationCap className="size-5" /> },
    { label: 'Audit Logs', path: '/admin/logs', icon: <ScrollText className="size-5" /> },
    { label: 'Settings', path: '/admin/settings', icon: <Settings className="size-5" /> },
  ];

  const getNavItems = () => {
    if (!currentUser) return publicNav;
    switch (currentUser.role) {
      case 'student':
        return studentNav;
      case 'teacher':
        return teacherNav;
      case 'admin':
        return adminNav;
      default:
        return publicNav;
    }
  };

  const navItems = isPublicVariant ? publicNav : getNavItems();
  const unreadCount = !isPublicVariant
    ? userNotifications.filter(notification => !notification.read).length
    : 0;

  const handleNavClick = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  // For public pages, render without sidebar
  if (isPublicVariant) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Top nav for public pages */}
        <nav className="border-b bg-card sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <button onClick={() => navigate('/')} className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center">
                    <GraduationCap className="size-5 text-primary" />
                  </div>
                  <span className="font-medium">NCE</span>
                </button>
                <div className="hidden md:flex items-center gap-1">
                  {navItems.map(item => (
                    <Button
                      key={item.path}
                      variant={currentPath === item.path ? 'secondary' : 'ghost'}
                      onClick={() => navigate(item.path)}
                      className="gap-2"
                    >
                      {item.icon}
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => navigate('/login')}>
                  Login
                </Button>
                <Button onClick={() => navigate('/login')}>Get Started</Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex-1">{children}</main>

        {/* Footer */}
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
              © 2025 NCE. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Authenticated layout with sidebar
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="h-16 border-b bg-card flex items-center px-4 gap-4 sticky top-0 z-50">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        <button onClick={() => navigate('/')} className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center">
            <GraduationCap className="size-5 text-primary" />
          </div>
          <span className="font-medium hidden sm:inline">NCE</span>
        </button>

        <div className="flex-1" />

        {/* Notification bell */}
        {currentUser.role === 'student' && (
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate('/student/notifications')}
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 size-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </Button>
        )}

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent transition-colors">
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
            {currentUser.role === 'student' && (
              <DropdownMenuItem onClick={() => navigate('/student/profile')}>
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
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 fixed md:relative inset-y-0 left-0 z-40
            w-64 border-r bg-card transition-transform duration-200 ease-in-out
            flex flex-col mt-16 md:mt-0
          `}
        >
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map(item => (
              <Button
                key={item.path}
                variant={currentPath === item.path ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-3"
                onClick={() => handleNavClick(item.path)}
              >
                {item.icon}
                {item.label}
              </Button>
            ))}
          </nav>

          {showRoleSwitcher && (
            <div className="p-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Demo: Switch Role</p>
              <RoleSwitcher currentRole={currentUser.role} />
            </div>
          )}
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}









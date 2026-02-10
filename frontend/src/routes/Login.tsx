/**
 * Location: src/routes/Login.tsx
 * Purpose: Present the primary authentication route with email and Google flows.
 * Why: Keeps authentication UI encapsulated while routing logic stays in App.tsx.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Chrome, GraduationCap, Lock, Mail } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Separator } from '@components/ui/separator';
import { ApiError } from '@lib/apiClient';
import { ENABLE_DEV_AUTH_FALLBACK } from '@lib/constants';
import type { Role } from '@types/domain';
import { useAuthStore } from '@store/authStore';
import { useRouter } from '@lib/router';
import { toast } from 'sonner@2.0.3';

// Keep post-login redirects safe by scoping return paths to the active role.
const AUTH_ROUTE_BLOCKLIST = new Set(['/login', '/register', '/auth/oauth']);
const ROLE_LANDING: Record<Role, string> = {
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  admin: '/admin/dashboard',
  public: '/',
};

const stripSearchAndHash = (path: string) => path.split('?')[0]?.split('#')[0] ?? path;

const isAllowedReturnPath = (role: Role, path: string) => {
  if (!path.startsWith('/')) {
    return false;
  }
  const basePath = stripSearchAndHash(path);
  if (AUTH_ROUTE_BLOCKLIST.has(basePath)) {
    return false;
  }
  if (role === 'public') {
    return basePath === '/';
  }
  if (role === 'student') {
    return basePath === '/student' || basePath.startsWith('/student/');
  }
  if (role === 'teacher') {
    return basePath === '/teacher' || basePath.startsWith('/teacher/');
  }
  if (role === 'admin') {
    return basePath === '/admin' || basePath.startsWith('/admin/');
  }
  return false;
};

const resolvePostLoginPath = (role: Role, from?: string | null) => {
  if (from && isAllowedReturnPath(role, from)) {
    return from;
  }
  return ROLE_LANDING[role] ?? '/';
};

type ValidationIssue = {
  path?: Array<string | number>;
  message?: string;
};

type ValidationMap = {
  password?: string;
  email?: string;
};

const FRIENDLY_VALIDATION_MESSAGES: ValidationMap = {
  password: 'Password is required.',
  email: 'Enter a valid email address.',
};

// Pull the most relevant validation issue out of backend Zod responses for display.
const pickValidationMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const details = (payload as { details?: unknown }).details;
  if (!Array.isArray(details)) {
    return null;
  }

  const issues = details as ValidationIssue[];
  const passwordIssue = issues.find((issue) => issue.path?.includes('password'));
  if (passwordIssue?.message) {
    return FRIENDLY_VALIDATION_MESSAGES.password ?? passwordIssue.message;
  }

  const emailIssue = issues.find((issue) => issue.path?.includes('email'));
  if (emailIssue?.message) {
    return FRIENDLY_VALIDATION_MESSAGES.email ?? emailIssue.message;
  }

  const fallbackMessage = issues.find((issue) => issue.message)?.message ?? null;
  return fallbackMessage;
};

export function LoginRoute() {
  const { login, loginWithGoogle, isAuthenticated, currentUser } = useAuthStore();
  const { navigate, currentPath } = useRouter();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const state = location.state as { from?: string } | null;
  const returnTo = typeof state?.from === 'string' ? state.from : null;

  useEffect(() => {
    if (!isAuthenticated || currentUser.role === 'public') {
      return;
    }
    if (currentPath !== '/login') {
      return;
    }
    const destination = resolvePostLoginPath(currentUser.role, returnTo);
    navigate(destination, { replace: true });
  }, [currentPath, currentUser.role, isAuthenticated, navigate, returnTo]);

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const mode = await login(email, password);
      if (mode === 'live') {
        toast.success('Signed in successfully.');
        return;
      }
      if (mode === 'persona') {
        toast.success('Signed in with demo mode. Use Passw0rd! for personas.');
        return;
      }
      const fallbackMessage = ENABLE_DEV_AUTH_FALLBACK
        ? 'Invalid credentials. Try Passw0rd! for demo access.'
        : 'Invalid email or password.';
      setErrorMessage(fallbackMessage);
    } catch (error) {
      const validationMessage =
        error instanceof ApiError && error.status === 400
          ? pickValidationMessage(error.details)
          : null;
      const fallbackMessage = validationMessage ?? 'Unable to sign in. Please try again.';
      setErrorMessage(fallbackMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      await loginWithGoogle();
      toast.info('Redirecting to Google...');
    } catch (error) {
      setIsLoading(false);
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to start Google sign-in. Please try again.';
      toast.error(message);
    }
  };

  const handleNavigateToRegister = () => {
    if (isLoading) {
      return;
    }
    navigate('/register');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E6F0FF] via-[#BFD9FF]/30 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="size-12 rounded-xl bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center mx-auto mb-2">
            <GraduationCap className="size-6 text-primary" />
          </div>
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>Sign in to your NCE account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Login */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <Chrome className="mr-2 size-5" />
            Continue with Google
          </Button>

          <div className="relative">
            <Separator />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-card px-2 text-xs text-muted-foreground">or</span>
            </div>
          </div>

          {/* Email Login */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {errorMessage && (
              <Alert variant="destructive">
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            <button className="hover:text-foreground">Forgot password?</button>
          </div>

          <Separator />

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <button
              className="font-medium hover:underline"
              onClick={handleNavigateToRegister}
              disabled={isLoading}
            >
              Create one
            </button>
          </div>

          {ENABLE_DEV_AUTH_FALLBACK && (
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Demo accounts:</p>
              <p>Student: alice@example.com</p>
              <p>Teacher: carol@example.com</p>
              <p>Admin: david@example.com</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}






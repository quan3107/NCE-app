/**
 * Location: src/routes/Login.tsx
 * Purpose: Present the primary authentication route with email and Google flows.
 * Why: Keeps authentication UI encapsulated while routing logic stays in App.tsx.
 */

import { useState } from 'react';
import { Chrome, GraduationCap, Lock, Mail } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Separator } from '@components/ui/separator';
import { ApiError } from '@lib/apiClient';
import { useAuthStore } from '@store/authStore';
import { useRouter } from '@lib/router';
import { toast } from 'sonner@2.0.3';

export function LoginRoute() {
  const { login, loginWithGoogle } = useAuthStore();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
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
      toast.error('Invalid credentials. Try Passw0rd! for demo access.');
    } catch {
      toast.error('Unable to sign in. Please try again.');
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
                  onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

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

          {/* Demo hint */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Demo accounts:</p>
            <p>Student: alice@example.com</p>
            <p>Teacher: carol@example.com</p>
            <p>Admin: david@example.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}






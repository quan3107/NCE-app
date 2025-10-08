/**
 * Location: src/routes/OAuth.tsx
 * Purpose: Handle the simulated OAuth callback route and redirect users post-login.
 * Why: Keeps the OAuth flow encapsulated within routing after the refactor.
 */

import { useEffect } from 'react';
import { Chrome, GraduationCap } from 'lucide-react';
import { Card, CardContent } from '@components/ui/card';
import { Progress } from '@components/ui/progress';
import { useAuthStore } from '@store/authStore';
import { useRouter } from '@lib/router';

export function OAuthRoute() {
  const { loginWithGoogle, currentUser } = useAuthStore();
  const { navigate } = useRouter();

  useEffect(() => {
    // Simulate OAuth callback process
    const handleOAuthCallback = async () => {
      // Wait a bit to show the loading state
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Complete the Google login
      await loginWithGoogle();
    };

    handleOAuthCallback();
  }, [loginWithGoogle]);

  // Redirect to dashboard once user is authenticated
  useEffect(() => {
    if (currentUser) {
      // Navigate based on user role
      if (currentUser.role === 'student') {
        navigate('/student/dashboard');
      } else if (currentUser.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else if (currentUser.role === 'admin') {
        navigate('/admin/dashboard');
      }
    }
  }, [currentUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E6F0FF] via-[#BFD9FF]/30 to-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-12 pb-12 text-center">
          <div className="size-16 rounded-xl bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="size-8 text-primary" />
          </div>
          
          <div className="mb-6">
            <Chrome className="size-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
            <h2 className="mb-2">Connecting to Google</h2>
            <p className="text-muted-foreground">
              Please wait while we complete the authentication process...
            </p>
          </div>

          <Progress value={66} className="mb-4" />

          <p className="text-xs text-muted-foreground">
            You'll be redirected automatically
          </p>
        </CardContent>
      </Card>
    </div>
  );
}






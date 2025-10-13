/**
 * Location: src/routes/OAuth.tsx
 * Purpose: Handle the simulated OAuth callback route and redirect users post-login.
 * Why: Keeps the OAuth flow encapsulated within routing after the refactor.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chrome, GraduationCap } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Progress } from '@components/ui/progress';
import { ApiError } from '@lib/apiClient';
import { useAuthStore } from '@store/authStore';
import { useRouter } from '@lib/router';

type OAuthStatus = 'working' | 'success' | 'error';

export function OAuthRoute() {
  const { completeGoogleLogin, currentUser } = useAuthStore();
  const { navigate } = useRouter();
  const [status, setStatus] = useState<OAuthStatus>('working');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasAttemptedRef = useRef(false);

  const searchParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }, []);

  const googleStatus = searchParams.get('googleAuth');
  const googleMessage = searchParams.get('googleAuthMessage');

  useEffect(() => {
    if (googleStatus === 'error') {
      setStatus('error');
      setErrorMessage(
        googleMessage ?? 'Google sign-in was cancelled or could not be completed.',
      );
      return;
    }

    if (hasAttemptedRef.current) {
      return;
    }
    hasAttemptedRef.current = true;
    setStatus('working');

    void (async () => {
      try {
        await completeGoogleLogin();
        setStatus('success');
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('googleAuth');
          url.searchParams.delete('googleAuthMessage');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : 'Unable to finalize Google sign-in. Please try again.';
        setErrorMessage(message);
        setStatus('error');
      }
    })();
  }, [completeGoogleLogin, googleMessage, googleStatus]);

  useEffect(() => {
    if (status !== 'success' || !currentUser) {
      return;
    }

    if (currentUser.role === 'student') {
      navigate('/student/dashboard');
      return;
    }
    if (currentUser.role === 'teacher') {
      navigate('/teacher/dashboard');
      return;
    }
    if (currentUser.role === 'admin') {
      navigate('/admin/dashboard');
      return;
    }

    navigate('/');
  }, [currentUser, navigate, status]);

  const showError = status === 'error';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E6F0FF] via-[#BFD9FF]/30 to-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-12 pb-12 text-center space-y-6">
          <div className="size-16 rounded-xl bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center mx-auto">
            <GraduationCap className="size-8 text-primary" />
          </div>

          <div className="space-y-2">
            <Chrome
              className={`size-12 mx-auto ${showError ? 'text-destructive' : 'text-muted-foreground animate-pulse'}`}
            />
            <h2>{showError ? 'Google sign-in could not complete' : 'Connecting to Google'}</h2>
            <p className="text-muted-foreground text-sm">
              {showError
                ? errorMessage ?? 'We hit a snag while finalizing Google authentication.'
                : 'Please wait while we confirm your Google sign-in...'}
            </p>
          </div>

          {!showError ? (
            <>
              <Progress value={66} className="mb-2" />
              <p className="text-xs text-muted-foreground">You will be redirected automatically</p>
            </>
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Return to login
              </Button>
              <p className="text-xs text-muted-foreground">
                The Google flow may have expired. Please try again from the login screen.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


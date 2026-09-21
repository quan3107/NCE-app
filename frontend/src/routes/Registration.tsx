/**
 * Location: src/routes/Registration.tsx
 * Purpose: Present the user registration flow, invoking the live API while retaining the demo Google placeholder.
 * Why: Keeps onboarding cohesive now that backend signup persists real accounts.
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Separator } from '@components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { useAuth } from '@lib/auth';
import { ApiError } from '@lib/apiClient';
import { profileNameFieldError, validateProfileDisplayName } from '@features/profile/profileValidation';
import type { RegisterRole } from '@lib/auth-types';
import { useRouter } from '@lib/router';
import { GraduationCap, Mail, Lock, Chrome, User, UserCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { RegistrationInformation, RegistrationTerms } from './RegistrationDetails';

export function AuthRegister() {
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const { currentUser, isAuthenticated, register, loginWithGoogle } = useAuth();
  const { navigate, currentPath } = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<{ field: string; message: string } | null>(null);

  // Navigate when user is already logged in
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const targetPath = currentUser.role === 'student' ? '/student/dashboard'
        : currentUser.role === 'teacher' ? '/teacher/dashboard'
        : '/admin/dashboard';
      
      // Only navigate if we're still on the register page
      if (currentPath === '/register') {
        navigate(targetPath);
      }
    }
  }, [currentPath, currentUser, isAuthenticated, navigate]);

  const handleInputChange = (field: string, value: string) => {
    setValidationError(null);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.current) return;
    setIsLoading(true);

    const validatedName = validateProfileDisplayName(formData.fullName);
    setFullNameError(validatedName.error);
    if (validatedName.error) {
      setIsLoading(false);
      return;
    }

    if (!formData.role) {
      setValidationError({ field: 'role', message: 'Please select your role' });
      toast.error('Please select your role');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setValidationError({ field: 'password', message: 'Password must be at least 8 characters' });
      toast.error('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setValidationError({ field: 'confirmPassword', message: 'Passwords do not match' });
      toast.error('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (!agreedToTerms) {
      setValidationError({ field: 'terms', message: 'Please accept the Terms and Conditions' });
      toast.error('Please accept the Terms and Conditions');
      setIsLoading(false);
      return;
    }

    pending.current = true;
    try {
      const result = await register({
        fullName: validatedName.normalizedName,
        email: formData.email,
        password: formData.password,
        role: formData.role as RegisterRole,
      });

      if (!mounted.current) return;
      if (result === 'pending_approval') {
        toast.success(
          'Teacher account request submitted. Please wait for admin approval before signing in.',
        );
        navigate('/login');
        return;
      }

      toast.success('Account created successfully!');
      navigate('/student/dashboard');
    } catch (error) {
      if (!mounted.current) return;
      const fieldError = profileNameFieldError(error);
      if (fieldError) {
        setFullNameError(fieldError);
      } else if (error instanceof ApiError) {
        setValidationError({ field: 'email', message: error.message || 'Registration failed. Please try again.' });
        toast.error(error.message || 'Registration failed. Please try again.');
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      pending.current = false;
      if (mounted.current) setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
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
          : 'Unable to start Google sign-up. Please try again.';
      toast.error(message);
    }
  };

  const handleNavigateToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E6F0FF] via-[#BFD9FF]/30 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="size-12 rounded-xl bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center mx-auto mb-2">
            <GraduationCap className="size-6 text-primary" />
          </div>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Join NCE to start your IELTS journey</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Register */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleRegister}
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

          {/* Email Registration */}
          <form onSubmit={handleEmailRegister} className="space-y-4">
            {validationError && <p id="registration-error" role="alert" className="text-sm text-destructive">{validationError.message}</p>}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => {
                    setFullNameError(null);
                    handleInputChange('fullName', e.target.value);
                  }}
                  className="pl-10"
                  aria-invalid={Boolean(fullNameError)}
                  aria-describedby={fullNameError ? 'fullName-error' : undefined}
                  required
                />
              </div>
              {fullNameError && (
                <p id="fullName-error" role="alert" className="text-sm text-destructive">
                  {fullNameError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  aria-invalid={validationError?.field === 'email'}
                  aria-describedby={validationError?.field === 'email' ? 'registration-error' : undefined}
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">I am a...</Label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10 pointer-events-none" />
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange('role', value)}
                  required
                >
                  <SelectTrigger id="role" className="pl-10" aria-invalid={validationError?.field === 'role'} aria-describedby={validationError?.field === 'role' ? 'registration-error' : undefined}>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  aria-invalid={validationError?.field === 'password'}
                  aria-describedby={validationError?.field === 'password' ? 'registration-error' : undefined}
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
              <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  aria-invalid={validationError?.field === 'confirmPassword'}
                  aria-describedby={validationError?.field === 'confirmPassword' ? 'registration-error' : undefined}
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <RegistrationTerms
              errorId={validationError?.field === 'terms' ? 'registration-error' : undefined}
              checked={agreedToTerms}
              onCheckedChange={(checked) => { setAgreedToTerms(checked); setValidationError(null); }}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <Separator />

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <button 
              className="font-medium hover:underline"
              onClick={handleNavigateToLogin}
              disabled={isLoading}
            >
              Sign in
            </button>
          </div>

          <RegistrationInformation />
        </CardContent>
      </Card>
    </div>
  );
}

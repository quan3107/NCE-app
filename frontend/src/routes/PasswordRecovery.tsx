/**
 * Location: routes/PasswordRecovery.tsx
 * Purpose: Accessible password recovery request and single-use reset forms.
 * Why: Keep recovery independent of an existing session and never disclose accounts.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { ApiError, apiClient } from "@lib/apiClient";
import { useMutationLifetime } from "@lib/useMutationLifetime";

export function PasswordRecoveryRoute() {
  const location = useLocation();
  const captureLifetime = useMutationLifetime();
  const isReset = location.pathname === "/reset-password";
  // The secret is held only in memory. Never persist it in browser storage.
  const token = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const feedback = useRef<HTMLDivElement>(null);
  const invalidToken = isReset && !/^[a-f0-9]{64}$/.test(token);

  useEffect(() => {
    if (success || error) feedback.current?.focus();
  }, [success, error]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (isReset && password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const isCurrent = captureLifetime();
    try {
      const result = await apiClient<{ message: string }>(
        isReset ? "/auth/reset-password" : "/auth/forgot-password",
        {
          auth: "none",
          method: "POST",
          credentials: "omit",
          body: isReset ? { token, password } : { email: email.trim() },
        },
      );
      // The server may finish after the user has left this recovery form.
      if (!isCurrent()) return;
      setPassword("");
      setConfirmation("");
      setSuccess(result.message);
      // Clear pending state before removing the fragment changes the lifetime URL.
      setBusy(false);
      if (isReset)
        window.history.replaceState(
          window.history.state,
          "",
          location.pathname,
        );
    } catch (cause) {
      if (!isCurrent()) return;
      setError(
        cause instanceof ApiError && cause.status !== 0
          ? cause.message
          : "Unable to connect. Check your connection and try again.",
      );
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-semibold">
            {isReset ? "Reset your password" : "Forgot your password?"}
          </h1>
          <CardDescription>
            {isReset
              ? "Choose a password with at least 8 characters. All existing sessions will be signed out."
              : "Enter your account email. Reset links expire after 30 minutes. Google-only accounts should continue with Google."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {invalidToken ? (
            <div role="alert">
              This password reset link is invalid or missing. Request a new
              link.
            </div>
          ) : success ? (
            <div
              ref={feedback}
              tabIndex={-1}
              role="status"
              className="rounded-md border p-4"
            >
              {success}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
              {isReset ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-password">New password</Label>
                    <Input
                      id="recovery-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={busy}
                      aria-describedby="recovery-error"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-confirm">
                      Confirm new password
                    </Label>
                    <Input
                      id="recovery-confirm"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      disabled={busy}
                      aria-describedby="recovery-error"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">Email address</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    maxLength={320}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                    aria-describedby="recovery-error"
                  />
                </div>
              )}
              <div
                id="recovery-error"
                ref={feedback}
                tabIndex={-1}
                role="alert"
                className="text-destructive"
              >
                {error}
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : isReset
                    ? "Reset password"
                    : "Send reset link"}
              </Button>
            </form>
          )}
          {isReset && !success && (
            <Link className="block text-sm underline" to="/forgot-password">
              Request a new reset link
            </Link>
          )}
          {/* A full navigation rechecks the server session after a reset. */}
          <a className="block text-sm underline" href="/login">
            Back to sign in
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Location: src/routes/GoogleLinkDialog.tsx
 * Purpose: Ask for explicit account-link consent and the existing password.
 * Why: Preserve the original account without treating email as ownership proof.
 */
import { useEffect, useRef, useState } from "react";
import { apiClient, ApiError } from "@lib/apiClient";
import { useRouter } from "@lib/router";
import { useAuthStore } from "@store/authStore";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";

type Challenge = { challengeId: string; email: string; expiresAt: string };
export function GoogleLinkDialog() {
  const { navigate } = useRouter();
  const { loginWithGoogle } = useAuthStore();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    void apiClient<Challenge>("/auth/google/link", {
      auth: "none",
      credentials: "include",
      signal: controller.signal,
    })
      .then((result) => {
        if (active.current && !controller.signal.aborted) setChallenge(result);
      })
      .catch((reason: unknown) => {
        if (active.current && !controller.signal.aborted)
          setError(
            reason instanceof ApiError
              ? reason.message
              : "Unable to load account linking. Try Google sign-in again.",
          );
      });
    return () => {
      active.current = false;
      controller.abort();
    };
  }, []);

  async function act(cancel: boolean) {
    if (submitting.current) return;
    if (!challenge) {
      if (cancel) navigate("/login");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await apiClient(`/auth/google/link${cancel ? "/cancel" : ""}`, {
        method: "POST",
        auth: "none",
        credentials: "include",
        body: cancel
          ? { challengeId: challenge.challengeId }
          : { challengeId: challenge.challengeId, consent: true, password },
      });
      if (!active.current) return;
      setPassword("");
      if (cancel) navigate("/login");
      else setLinked(true);
    } catch (reason) {
      if (!active.current) return;
      setPassword("");
      // A consumed/expired/conflicting proof cannot be retried in this dialog.
      // Keep a route back to login even when a successful response was lost.
      if (
        reason instanceof ApiError &&
        (reason.status === 400 || reason.status === 409)
      ) {
        setChallenge(null);
      }
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to confirm account linking. Try again.",
      );
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          if (linked) navigate("/login");
          else void act(true);
        }
      }}
    >
      <DialogContent
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {linked
              ? "Google account linked"
              : "Link Google to your existing account?"}
          </DialogTitle>
          <DialogDescription>
            {linked
              ? "Your account and data are preserved. You can now sign in with Google or your existing password."
              : challenge
                ? `An account already exists for ${challenge.email}. Enter its password to link Google. Your account and all its data will be kept.`
                : error
                  ? "Return to login and start Google sign-in again."
                  : "Checking your Google sign-in…"}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {linked ? (
          <div className="flex flex-col gap-3">
            <Button
              disabled={busy}
              onClick={() => {
                if (submitting.current) return;
                submitting.current = true;
                setBusy(true);
                void loginWithGoogle().catch((reason: unknown) => {
                  submitting.current = false;
                  if (active.current) {
                    setBusy(false);
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Please try signing in again.",
                    );
                  }
                });
              }}
            >
              {busy ? "Connecting…" : "Continue with Google"}
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => navigate("/login")}
            >
              Sign in with password
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void act(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="link-password">Existing account password</Label>
              <Input
                id="link-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy || !challenge}
                required
                maxLength={1024}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              By selecting “Link accounts”, you agree to use this Google account
              to sign in. This request expires in five minutes.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void act(true);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !challenge || !password}>
                {busy ? "Please wait…" : "Link accounts"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

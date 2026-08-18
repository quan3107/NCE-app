/**
 * Location: frontend/e2e/auth-cookie-race.harness.tsx
 * Purpose: Expose production auth operations to focused browser regressions.
 * Why: Lets Playwright control cross-tab cookie races without app UI noise.
 */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { apiClient } from '../src/lib/apiClient';
import { AuthProvider, useAuth } from '../src/lib/auth';

type AuthAction = 'login-a' | 'login-b' | 'logout' | 'restore' | 'switch-b';

function Harness() {
  const auth = useAuth();
  const [switchStatus, setSwitchStatus] = useState('idle');
  const [restoreStatus, setRestoreStatus] = useState('idle');
  const [failure, setFailure] = useState<{
    action: AuthAction;
    message: string;
  } | null>(null);

  const startProtectedRequest = () => {
    void apiClient('/race-protected', {
      auth: 'required',
      method: 'POST',
    }).catch(() => undefined);
  };

  const runAction = async (action: AuthAction) => {
    setFailure(null);
    try {
      if (action === 'login-a' || action === 'login-b') {
        const account = action === 'login-a' ? 'a' : 'b';
        await auth.login(`${account}@example.com`, 'password');
      } else if (action === 'logout') {
        await auth.logout();
      } else if (action === 'switch-b') {
        setSwitchStatus('switching');
        await auth.logout();
        await auth.login('b@example.com', 'password');
        setSwitchStatus('complete');
      } else {
        const restored = await auth.restoreLiveSession();
        setRestoreStatus(restored ? 'success' : 'failed');
      }
    } catch (error) {
      const unavailable =
        error instanceof Error &&
        error.name === 'AuthCoordinationUnavailableError';
      setFailure({
        action,
        message: unavailable
          ? 'Authentication coordination is unavailable. Restore browser storage permissions and retry.'
          : 'Authentication operation failed or timed out. Please retry.',
      });
    }
  };

  return (
    <main>
      <div data-testid="current-user">{auth.currentUser.id || 'guest'}</div>
      <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="restoring">{String(auth.isRestoringSession)}</div>
      <div data-testid="switch-status">{switchStatus}</div>
      <div data-testid="restore-status">{restoreStatus}</div>
      {failure && (
        <div role="alert">
          <p>{failure.message}</p>
          <button onClick={() => void runAction(failure.action)}>
            Retry {failure.action.startsWith('login') ? 'login' : failure.action}
          </button>
        </div>
      )}
      <button onClick={() => void runAction('login-a')}>
        Login A
      </button>
      <button onClick={() => void runAction('login-b')}>
        Login B
      </button>
      <button onClick={() => void runAction('logout')}>Logout</button>
      <button onClick={startProtectedRequest}>Start protected request</button>
      <button onClick={() => void runAction('switch-b')}>Switch to B</button>
      <button onClick={() => void runAction('restore')}>Restore B session</button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <Harness />
  </AuthProvider>,
);

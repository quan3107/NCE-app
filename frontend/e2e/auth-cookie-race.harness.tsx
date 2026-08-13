/**
 * Location: frontend/e2e/auth-cookie-race.harness.tsx
 * Purpose: Expose production auth operations to focused browser regressions.
 * Why: Lets Playwright control cross-tab cookie races without app UI noise.
 */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { apiClient } from '../src/lib/apiClient';
import { AuthProvider, useAuth } from '../src/lib/auth';

function Harness() {
  const auth = useAuth();
  const [switchStatus, setSwitchStatus] = useState('idle');
  const [restoreStatus, setRestoreStatus] = useState('idle');

  const startProtectedRequest = () => {
    void apiClient('/race-protected', {
      auth: 'required',
      method: 'POST',
    }).catch(() => undefined);
  };

  const switchToB = async () => {
    setSwitchStatus('switching');
    await auth.logout();
    await auth.login('b@example.com', 'password');
    setSwitchStatus('complete');
  };

  const restore = async () => {
    const restored = await auth.restoreLiveSession();
    setRestoreStatus(restored ? 'success' : 'failed');
  };

  return (
    <main>
      <div data-testid="current-user">{auth.currentUser.id || 'guest'}</div>
      <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="restoring">{String(auth.isRestoringSession)}</div>
      <div data-testid="switch-status">{switchStatus}</div>
      <div data-testid="restore-status">{restoreStatus}</div>
      <button onClick={() => auth.login('a@example.com', 'password')}>
        Login A
      </button>
      <button onClick={() => auth.login('b@example.com', 'password')}>
        Login B
      </button>
      <button onClick={() => auth.logout()}>Logout</button>
      <button onClick={startProtectedRequest}>Start protected request</button>
      <button onClick={switchToB}>Switch to B</button>
      <button onClick={restore}>Restore B session</button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <Harness />
  </AuthProvider>,
);

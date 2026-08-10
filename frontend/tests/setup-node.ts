/**
 * Location: tests/setup-node.ts
 * Purpose: Admit protected API calls in transport-focused Node tests.
 * Why: Those tests run without React bootstrap but still exercise authenticated endpoints.
 */

import { authBridge } from '../src/lib/authBridge';

const controller = new AbortController();
authBridge.configure({
  admit: () => ({
    accessToken: 'node-test-access-token',
    actorId: 'node-test-user',
    revision: 1,
    signal: controller.signal,
  }),
  isCurrent: () => true,
  getSnapshot: () => ({
    status: 'authenticated',
    revision: 1,
    accessToken: 'node-test-access-token',
    actor: { id: 'node-test-user', role: 'student' },
  }),
});

/**
 * Location: tests/setup-node.ts
 * Purpose: Admit protected API calls in transport-focused Node tests.
 * Why: Those tests run without React bootstrap but still exercise authenticated endpoints.
 */

import { authBridge } from '../src/lib/authBridge';

authBridge.configure({
  getAccessToken: () => 'node-test-access-token',
  getSessionVersion: () => ({
    generation: 1,
    sessionEpoch: 1,
    userId: 'node-test-user',
  }),
});

/**
 * Location: frontend/e2e/auth-cookie-race.server.ts
 * Purpose: Serve deterministic auth responses with real refresh cookies.
 * Why: Browser tests must observe Set-Cookie ordering that fetch mocks cannot model.
 */

import { createServer, type ServerResponse } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 4010;
const COOKIE = 'refreshToken';

const users = {
  a: {
    id: 'user-a',
    email: 'a@example.com',
    fullName: 'User A',
    role: 'student',
  },
  b: {
    id: 'user-b',
    email: 'b@example.com',
    fullName: 'User B',
    role: 'student',
  },
} as const;

let releaseARefresh!: () => void;
let aRefreshGate!: Promise<void>;
let releaseDelayedLogin!: () => void;
let delayedLoginGate!: Promise<void>;
let releaseDelayedLogout!: () => void;
let delayedLogoutGate!: Promise<void>;

function resetRefreshGate() {
  aRefreshGate = new Promise((resolve) => {
    releaseARefresh = resolve;
  });
  delayedLoginGate = new Promise((resolve) => {
    releaseDelayedLogin = resolve;
  });
  delayedLogoutGate = new Promise((resolve) => {
    releaseDelayedLogout = resolve;
  });
}

resetRefreshGate();

function addCors(response: ServerResponse) {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3010');
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  cookie?: string,
) {
  addCors(response);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  if (cookie) {
    response.setHeader('Set-Cookie', cookie);
  }
  response.end(JSON.stringify(body));
}

function authCookie(value: string) {
  return `${COOKIE}=${value}; Path=/api/v1/auth; HttpOnly; SameSite=Lax`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookie(header: string | undefined) {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

function sendAuth(
  response: ServerResponse,
  account: keyof typeof users,
  refreshToken: string,
) {
  sendJson(
    response,
    200,
    { user: users[account], accessToken: `access-${account}` },
    authCookie(refreshToken),
  );
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);

  if (request.method === 'OPTIONS') {
    addCors(response);
    response.statusCode = 204;
    response.end();
    return;
  }

  if (url.pathname === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/test/reset' && request.method === 'POST') {
    resetRefreshGate();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/test/release-refresh' && request.method === 'POST') {
    releaseARefresh();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/test/release-login' && request.method === 'POST') {
    releaseDelayedLogin();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/test/release-logout' && request.method === 'POST') {
    releaseDelayedLogout();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/v1/auth/login' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
    }
    const email = (JSON.parse(body) as { email: string }).email;
    if (email.startsWith('delayed-a@')) {
      await delayedLoginGate;
    }
    const account = email.startsWith('b@') ? 'b' : 'a';
    sendAuth(response, account, `${account}-refresh-1`);
    return;
  }

  if (url.pathname === '/api/v1/auth/logout' && request.method === 'POST') {
    if (url.searchParams.get('delay') === 'true') {
      await delayedLogoutGate;
    }
    addCors(response);
    response.statusCode = 204;
    response.setHeader('Set-Cookie', clearCookie());
    response.end();
    return;
  }

  if (url.pathname === '/api/v1/auth/refresh' && request.method === 'POST') {
    const token = readCookie(request.headers.cookie);
    if (token?.startsWith('a-')) {
      await aRefreshGate;
      sendAuth(response, 'a', 'a-refresh-2');
      return;
    }
    if (token?.startsWith('b-')) {
      sendAuth(response, 'b', 'b-refresh-2');
      return;
    }
    sendJson(response, 401, { message: 'Missing refresh session' }, clearCookie());
    return;
  }

  if (url.pathname === '/api/v1/race-protected' && request.method === 'POST') {
    sendJson(response, 401, { message: 'Refresh required' });
    return;
  }

  sendJson(response, 404, { message: 'Not found' });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Auth cookie race server listening on ${HOST}:${PORT}\n`);
});

function closeServer() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);

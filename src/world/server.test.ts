import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Request, Response } from 'express';
import {
  CSP_HEADER_VALUE,
  checkApiQuota,
  consumeGlobalAiBudget,
  refundGlobalAiBudget,
  resetAiBudgetForTest,
  resetRateLimitsForTest,
  resolveSafeDistFile,
  safeDecodePathname,
  sanitizeFrameAncestorOrigin,
  selectContentEncoding,
  serveCompressedOrStatic,
  verifyApiAuth,
} from '../../server';
import { selectNextWriteSlot } from '../core/sessionStore';
import { resolveKeyboardShortcutAction } from '../hooks/useSessionAutosave';
import { getLocalizedShortcuts } from '../ui/shortcuts';

test('serveCompressedOrStatic blocks sibling path traversal via path.relative, allows valid filenames containing .., catches malformed decodeURIComponent with 400, and respects Accept-Encoding: br;q=0', async () => {
  const distDir = path.resolve('/app/applet/dist');
  const middleware = serveCompressedOrStatic(distDir);

  // 1. Path traversal to sibling directory (/..%2fdist-secret%2fsecret.json) is blocked via path.relative(distPath, resolvedFile)
  assert.equal(resolveSafeDistFile(distDir, '/../dist-secret/secret.json'), null);
  assert.equal(resolveSafeDistFile(distDir, '/assets/../../secret.json'), null);
  // Valid filenames containing consecutive dots inside a filename (not a '..' segment) are allowed
  assert.equal(
    resolveSafeDistFile(distDir, '/assets/chunk..hash123.js'),
    path.join(distDir, 'assets', 'chunk..hash123.js')
  );
  assert.equal(safeDecodePathname('/%E0%A4%A'), null);

  let nextCalledForTraversal = false;
  await middleware(
    {
      method: 'GET',
      path: '/..%2fdist-secret%2fsecret.json',
      headers: { 'accept-encoding': 'gzip, br' },
    } as unknown as Request,
    {} as unknown as Response,
    () => {
      nextCalledForTraversal = true;
    }
  );
  assert.equal(
    nextCalledForTraversal,
    true,
    'Middleware must reject sibling directory traversal and delegate to next()'
  );

  // 2. Malformed URI percent-encoding is caught by try-catch and returns HTTP 400 instead of throwing URIError (500)
  let statusCode = 200;
  let jsonBody: unknown = null;
  await middleware(
    {
      method: 'GET',
      path: '/%E0%A4%A',
      headers: { 'accept-encoding': 'br' },
    } as unknown as Request,
    {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        jsonBody = payload;
        return this;
      },
    } as unknown as Response,
    () => {}
  );
  assert.equal(statusCode, 400, 'Malformed URI must return HTTP 400');
  assert.ok(jsonBody && typeof jsonBody === 'object');

  // 3. Accept-Encoding: br;q=0 is respected (never serves br when q=0)
  assert.equal(selectContentEncoding('br;q=0'), null);
  assert.equal(selectContentEncoding('br;q=0, gzip;q=0.8'), 'gzip');
  assert.equal(selectContentEncoding('gzip;q=0, br;q=0'), null);

  let nextCalledForBrQ0 = false;
  await middleware(
    {
      method: 'GET',
      path: '/index.html',
      headers: { 'accept-encoding': 'br;q=0' },
    } as unknown as Request,
    {} as unknown as Response,
    () => {
      nextCalledForBrQ0 = true;
    }
  );
  assert.equal(
    nextCalledForBrQ0,
    true,
    'Middleware must not serve Brotli when Accept-Encoding specifies br;q=0'
  );
});

test('verifyApiAuth enforces timingSafeEqual token verification, ignores placeholder tokens, respects requireToken flag, and checkApiQuota + consumeGlobalAiBudget enforce quotas', () => {
  // Default / SPA mode when requireToken is false and API_AUTH_TOKEN is empty or a placeholder ("true", "change-me-in-production")
  assert.equal(verifyApiAuth({}, '', false), true);
  assert.equal(verifyApiAuth({}, 'true', false), true);
  assert.equal(verifyApiAuth({}, 'change-me-in-production', false), true);

  // Explicit requireToken=true requires a real non-placeholder API_AUTH_TOKEN
  assert.equal(verifyApiAuth({}, '', true), false);
  assert.equal(verifyApiAuth({}, 'true', true), false);
  assert.equal(verifyApiAuth({}, 'change-me-in-production', true), false);
  assert.equal(verifyApiAuth({ authorization: 'Bearer true' }, 'true', true), false);

  // Protected mode when a real API_AUTH_TOKEN is set
  assert.equal(verifyApiAuth({}, 'secret-123', false), false);
  assert.equal(verifyApiAuth({ authorization: 'Bearer wrong' }, 'secret-123', false), false);
  assert.equal(verifyApiAuth({ authorization: 'Bearer secret-1234' }, 'secret-123', false), false);
  assert.equal(verifyApiAuth({ authorization: 'Bearer secret-123' }, 'secret-123', false), true);
  assert.equal(verifyApiAuth({ 'x-api-key': 'secret-123' }, 'secret-123', true), true);

  // CSP uses strict worker-src 'self' (standard ES Module Worker, no blob: in worker-src) and frame-ancestors without wildcard *.run.app or placeholder MY_APP_URL
  assert.ok(
    CSP_HEADER_VALUE.includes("worker-src 'self'; child-src 'self';") &&
      !CSP_HEADER_VALUE.includes("worker-src 'self' blob:"),
    'CSP must restrict worker-src to self without blob: URLs'
  );
  assert.ok(
    CSP_HEADER_VALUE.includes("frame-ancestors 'self' https://aistudio.google.com") &&
      !CSP_HEADER_VALUE.includes('https://*.run.app') &&
      !CSP_HEADER_VALUE.includes('MY_APP_URL') &&
      CSP_HEADER_VALUE.includes("form-action 'self';"),
    'CSP must permit framing by AI Studio preview, omit wildcard *.run.app and placeholder MY_APP_URL, and restrict form-action to self'
  );
  assert.equal(sanitizeFrameAncestorOrigin('MY_APP_URL'), null);
  assert.equal(sanitizeFrameAncestorOrigin('https://example.com/some/path'), 'https://example.com');
  assert.equal(sanitizeFrameAncestorOrigin('javascript:alert(1)'), null);

  // Dismissed session slot pinning across 2nd, 3rd, and Nth autosaves
  assert.equal(selectNextWriteSlot('a', null), 'b');
  assert.equal(selectNextWriteSlot('b', null), 'a');
  assert.equal(selectNextWriteSlot('b', 'a'), 'b', 'When slot a is pinned (dismissed), subsequent autosaves must keep writing to slot b');
  assert.equal(selectNextWriteSlot('a', 'b'), 'a', 'When slot b is pinned (dismissed), subsequent autosaves must keep writing to slot a');

  // Global hourly AI budget + per-IP fairness check
  resetAiBudgetForTest();
  assert.equal(consumeGlobalAiBudget(1000, 2), true);
  assert.equal(consumeGlobalAiBudget(2000, 2), true);
  assert.equal(consumeGlobalAiBudget(3000, 2), false);
  assert.equal(consumeGlobalAiBudget(3_602_000, 2), true);
  resetAiBudgetForTest();
  // Single IP cannot exceed maxPerIpHourly even when global budget has room
  assert.equal(consumeGlobalAiBudget(1000, 200, 500, '10.0.0.9', 2), true);
  assert.equal(consumeGlobalAiBudget(2000, 200, 500, '10.0.0.9', 2), true);
  assert.equal(consumeGlobalAiBudget(3000, 200, 500, '10.0.0.9', 2), false);
  // Refunding a failed/null Gemini call restores both global and per-IP quota
  refundGlobalAiBudget('10.0.0.9');
  assert.equal(consumeGlobalAiBudget(3500, 200, 500, '10.0.0.9', 2), true);
  assert.equal(consumeGlobalAiBudget(3000, 200, 500, '10.0.0.10', 2), true);
  resetAiBudgetForTest();

  // Keyboard shortcut action resolution (Ctrl+Z -> undo, Ctrl+Shift+Z / Ctrl+Y -> redo, input ignored)
  assert.equal(
    resolveKeyboardShortcutAction({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, activeElementTagName: 'DIV' }),
    'undo'
  );
  assert.equal(
    resolveKeyboardShortcutAction({ key: 'Z', ctrlKey: true, metaKey: false, shiftKey: true, activeElementTagName: 'DIV' }),
    'redo'
  );
  assert.equal(
    resolveKeyboardShortcutAction({ key: 'y', ctrlKey: true, metaKey: false, shiftKey: false, activeElementTagName: 'DIV' }),
    'redo'
  );
  assert.equal(
    resolveKeyboardShortcutAction({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, activeElementTagName: 'INPUT' }),
    null
  );
  const localizedShortcuts = getLocalizedShortcuts();
  assert.ok(localizedShortcuts.some((s) => s.id === 'undo' && s.keys === 'Ctrl+Z'));
  assert.ok(localizedShortcuts.some((s) => s.id === 'redo' && s.keys.includes('Ctrl+Shift+Z')));

  resetRateLimitsForTest();
  // Byte quota check (25 MB per minute ceiling, including post-parse chunked byte adjustment without incrementing request count)
  const q1 = checkApiQuota('10.0.0.1', 15 * 1024 * 1024);
  assert.equal(q1.allowed, true);
  assert.equal(q1.remainingRequests, 19);
  const qChunked = checkApiQuota('10.0.0.1', 5 * 1024 * 1024, false);
  assert.equal(qChunked.allowed, true);
  assert.equal(qChunked.remainingRequests, 19, 'Post-parse chunked byte accounting must not double-count request');
  const q2 = checkApiQuota('10.0.0.1', 12 * 1024 * 1024);
  assert.equal(q2.allowed, false);
  assert.equal(q2.reason, 'byte_quota');

  // Request count check (20 requests per minute ceiling)
  resetRateLimitsForTest();
  for (let i = 0; i < 20; i++) {
    assert.equal(checkApiQuota('10.0.0.2', 1024).allowed, true);
  }
  const q21 = checkApiQuota('10.0.0.2', 1024);
  assert.equal(q21.allowed, false);
  assert.equal(q21.reason, 'rate_limit');
});

test('GET /api/<unknown> returns 404 JSON instead of SPA fallback and /healthz sets worker-src CSP header', async () => {
  const { app } = await import('../../server');
  const srv = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const addr = srv.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const healthRes = await fetch(`${baseUrl}/healthz`);
    assert.equal(healthRes.status, 200);
    const csp = healthRes.headers.get('content-security-policy') || '';
    assert.ok(
      csp.includes("worker-src 'self'; child-src 'self';") && !csp.includes("worker-src 'self' blob:"),
      'CSP header must restrict worker-src to self'
    );

    const unknownApiRes = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(unknownApiRes.status, 404, 'Unknown /api/* route must return HTTP 404');
    const contentType = unknownApiRes.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'), 'Unknown /api/* route must return JSON');
    const body = (await unknownApiRes.json()) as { error?: string };
    assert.ok(typeof body.error === 'string' && body.error.length > 0);

    // Client error log endpoint accepts <=8KB payload with 204 and rejects oversized payload with 413
    const logRes = await fetch(`${baseUrl}/api/client-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'boundary', message: 'Test error', label: 'Khung nhìn 3D' }),
    });
    assert.equal(logRes.status, 204, 'POST /api/client-log must return 204 No Content');

    const hugeLogRes = await fetch(`${baseUrl}/api/client-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'error', message: 'X'.repeat(12_000) }),
    });
    assert.equal(hugeLogRes.status, 413, 'POST /api/client-log >8KB must return 413');
  } finally {
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }
});



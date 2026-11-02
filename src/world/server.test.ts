import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { Request, Response } from 'express';
import {
  resolveSafeDistFile,
  safeDecodePathname,
  selectContentEncoding,
  serveCompressedOrStatic,
} from '../../server';

test('serveCompressedOrStatic blocks sibling path traversal via path.relative, catches malformed decodeURIComponent with 400, and respects Accept-Encoding: br;q=0', async () => {
  const distDir = path.resolve('/app/applet/dist');
  const middleware = serveCompressedOrStatic(distDir);

  // 1. Path traversal to sibling directory (/..%2fdist-secret%2fsecret.json) is blocked via path.relative(distPath, resolvedFile)
  assert.equal(resolveSafeDistFile(distDir, '/../dist-secret/secret.json'), null);
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

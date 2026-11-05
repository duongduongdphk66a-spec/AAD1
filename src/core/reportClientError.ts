const sent = new Set<string>();

export function reportClientError(kind: string, err: unknown, label?: string): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const key = `${kind}:${e.message}`;
  if (sent.has(key) || sent.size >= 20) return;
  sent.add(key);

  const mode =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE
      ? import.meta.env.MODE
      : 'unknown';

  const body = JSON.stringify({
    kind,
    message: e.message,
    stack: e.stack,
    label,
    build: mode,
  });

  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      typeof Blob !== 'undefined'
    ) {
      const ok = navigator.sendBeacon(
        '/api/client-log',
        new Blob([body], { type: 'application/json' })
      );
      if (ok) return;
    }
    if (typeof fetch === 'function') {
      void fetch('/api/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Ignore telemetry network errors
  }
}

export function resetClientErrorCacheForTest(): void {
  sent.clear();
}

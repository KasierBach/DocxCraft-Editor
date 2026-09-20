/** Optional error sink; disabled unless ERROR_TRACKING_URL is configured. */
const ERROR_TRACKING_TIMEOUT_MS = 2_000;

export function reportServerError(url: string | undefined, error: unknown, requestId?: string) {
  if (!url) return;
  const payload = JSON.stringify({
    message: error instanceof Error ? error.message : 'Unknown server error',
    name: error instanceof Error ? error.name : 'Error',
    requestId,
    timestamp: new Date().toISOString(),
  });
  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    signal: AbortSignal.timeout(ERROR_TRACKING_TIMEOUT_MS),
  }).catch(() => undefined);
}

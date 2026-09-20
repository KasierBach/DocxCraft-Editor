/** Optional error sink; disabled unless ERROR_TRACKING_URL is configured. */
export function reportServerError(url: string | undefined, error: unknown, requestId?: string) {
  if (!url) return;
  const payload = JSON.stringify({
    message: error instanceof Error ? error.message : 'Unknown server error',
    name: error instanceof Error ? error.name : 'Error',
    requestId,
    timestamp: new Date().toISOString(),
  });
  void fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload }).catch(() => undefined);
}

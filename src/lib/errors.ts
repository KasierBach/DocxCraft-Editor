/**
 * Turns thrown command errors into something a user can act on: network
 * failures and timeouts get plain-language messages instead of the raw
 * browser strings ("Failed to fetch", "The operation was aborted").
 *
 * Pass a `translate` function to localize the two generic messages; the
 * underlying error message (already user-facing) is passed through.
 */
export function describeCommandError(
  error: unknown,
  fallbackMessage: string,
  translate?: (key: string) => string,
): string {
  const pick = (key: string, fallback: string) => (translate ? translate(key) : fallback);

  if (error instanceof DOMException && error.name === 'AbortError') {
    return pick('errors.serverTimeout', 'The server took too long to respond.');
  }

  if (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message))
  ) {
    return pick('errors.serverUnreachable', 'Could not reach the server.');
  }

  return error instanceof Error && error.message ? error.message : fallbackMessage;
}

/**
 * A save that lost a revision race (HTTP 409). The store keeps the superseded
 * content as a version, so callers can retry against the current revision
 * without losing the other client's work. Checked structurally so injected API
 * doubles in tests can produce it without importing the real error class.
 */
export function isConflictError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 409
  );
}

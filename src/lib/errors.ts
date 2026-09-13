/**
 * Turns thrown command errors into something a user can act on: network
 * failures and timeouts get plain-language messages instead of the raw
 * browser strings ("Failed to fetch", "The operation was aborted").
 */
export function describeCommandError(error: unknown, fallbackMessage: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The server took too long to respond.';
  }

  if (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message))
  ) {
    return 'Could not reach the server.';
  }

  return error instanceof Error && error.message ? error.message : fallbackMessage;
}

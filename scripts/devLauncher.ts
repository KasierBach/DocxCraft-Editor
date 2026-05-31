export function createSpawnSpec(platform: string, scriptName: string) {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', `npm run ${scriptName}`],
    };
  }

  return {
    command: 'npm',
    args: ['run', scriptName],
  };
}

export async function isApiReachable(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs = 1200,
) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: abortController.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getApiStatus(
  fetchImpl: typeof fetch,
  url: string,
  expectedApiVersion: string,
  timeoutMs = 1200,
) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: abortController.signal,
    });

    if (!response.ok) {
      return {
        reachable: false,
        compatible: false,
        apiVersion: null,
      };
    }

    const payload = (await response.json()) as { apiVersion?: unknown } | null;
    const apiVersion = payload?.apiVersion ?? null;

    return {
      reachable: true,
      compatible: apiVersion === expectedApiVersion,
      apiVersion,
    };
  } catch {
    return {
      reachable: false,
      compatible: false,
      apiVersion: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

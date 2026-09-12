import { useCallback, useEffect, useState } from 'react';

import { withRequestTimeout } from '../lib/documentApi';

type ApiStatus = 'checking' | 'connected' | 'offline';

type UseApiStatusOptions = {
  healthUrl?: string;
  pollIntervalMs?: number;
};

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export function useApiStatus({
  healthUrl = '/api/health',
  pollIntervalMs = 15000,
}: UseApiStatusOptions = {}) {
  const [status, setStatus] = useState<ApiStatus>('checking');
  const [apiVersion, setApiVersion] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(
        healthUrl,
        withRequestTimeout({ cache: 'no-store' }, HEALTH_CHECK_TIMEOUT_MS),
      );
      if (!response.ok) {
        throw new Error(`API health check failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as { apiVersion?: string };
      setApiVersion(payload.apiVersion ?? null);
      setStatus('connected');
      return 'connected' as const;
    } catch {
      setStatus('offline');
      return 'offline' as const;
    }
  }, [healthUrl]);

  useEffect(() => {
    void refreshStatus();

    const intervalId = window.setInterval(() => {
      void refreshStatus();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pollIntervalMs, refreshStatus]);

  return {
    status,
    apiVersion,
    refreshStatus,
  };
}

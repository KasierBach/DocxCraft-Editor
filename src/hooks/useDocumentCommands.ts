import { useCallback } from 'react';

import { describeCommandError } from '../lib/errors';

type CommandTone = 'success' | 'error' | 'info';

type PushToast = (tone: CommandTone, message: string) => void;

type SetStatusMessage = (message: string) => void;

type RunCommandOptions<T> = {
  successMessage?: (result: T) => string;
  successTone?: CommandTone;
  failureStatus?: string;
};

type UseDocumentCommandsOptions = {
  pushToast: PushToast;
  setStatusMessage: SetStatusMessage;
};

/**
 * Shared wrapper for user-facing document commands. Each command reports
 * success and failure through the status bar and toast viewport using one
 * consistent shape instead of repeating try/catch/toast blocks per handler.
 */
export function useDocumentCommands({ pushToast, setStatusMessage }: UseDocumentCommandsOptions) {
  const runCommand = useCallback(
    async <T>(
      label: string,
      action: () => Promise<T>,
      options?: RunCommandOptions<T>,
    ): Promise<T | undefined> => {
      try {
        const result = await action();
        const message = options?.successMessage?.(result) ?? `${label} completed.`;
        setStatusMessage(message);
        pushToast(options?.successTone ?? 'success', message);
        return result;
      } catch (error) {
        const message = describeCommandError(error, `${label} failed.`);
        setStatusMessage(options?.failureStatus ?? `${label} failed.`);
        pushToast('error', message);
        return undefined;
      }
    },
    [pushToast, setStatusMessage],
  );

  return { runCommand };
}

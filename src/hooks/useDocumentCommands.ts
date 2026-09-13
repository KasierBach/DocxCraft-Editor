import { useCallback } from 'react';

import { describeCommandError } from '../lib/errors';
import { translate as translateMessage } from '../i18n';
import { en } from '../i18n/locales/en';

type CommandTone = 'success' | 'error' | 'info';

type PushToast = (tone: CommandTone, message: string) => void;

type SetStatusMessage = (message: string) => void;

type Translate = (key: string, vars?: Record<string, string | number>) => string;

type RunCommandOptions<T> = {
  successMessage?: (result: T) => string;
  successTone?: CommandTone;
  failureStatus?: string;
};

type UseDocumentCommandsOptions = {
  pushToast: PushToast;
  setStatusMessage: SetStatusMessage;
  translate?: Translate;
};

/**
 * Shared wrapper for user-facing document commands. Each command reports
 * success and failure through the status bar and toast viewport using one
 * consistent shape instead of repeating try/catch/toast blocks per handler.
 */
export function useDocumentCommands({
  pushToast,
  setStatusMessage,
  translate,
}: UseDocumentCommandsOptions) {
  const tr = useCallback<Translate>(
    (key, vars) => (translate ? translate(key, vars) : translateMessage(en, key, vars)),
    [translate],
  );

  const runCommand = useCallback(
    async <T>(
      label: string,
      action: () => Promise<T>,
      options?: RunCommandOptions<T>,
    ): Promise<T | undefined> => {
      try {
        const result = await action();
        const labelText = tr(label);
        const message = options?.successMessage?.(result) ?? tr('app.commandCompleted', { label: labelText });
        setStatusMessage(message);
        pushToast(options?.successTone ?? 'success', message);
        return result;
      } catch (error) {
        const labelText = tr(label);
        const failureMessage = tr('app.commandFailed', { label: labelText });
        const message = describeCommandError(error, failureMessage, (key) => tr(key));
        setStatusMessage(options?.failureStatus ?? failureMessage);
        pushToast('error', message);
        return undefined;
      }
    },
    [pushToast, setStatusMessage, tr],
  );

  return { runCommand };
}

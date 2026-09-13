import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { en, type Message, type MessageVars, type Messages } from './locales/en';
import { vi } from './locales/vi';

export type Language = 'en' | 'vi';

const CATALOGS: Record<Language, Messages> = { en, vi };
const STORAGE_KEY = 'docxcraft:language';

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'vi';
}

/** Stored preference wins, then the browser language, then English. */
function detectLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode).
  }

  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('vi')) {
    return 'vi';
  }

  return 'en';
}

function resolveMessage(catalog: Messages, key: string): Message | undefined {
  const value = key
    .split('.')
    .reduce<unknown>(
      (current, segment) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      catalog,
    );

  return typeof value === 'string' || typeof value === 'function' ? (value as Message) : undefined;
}

/** Resolves a dot-path key, falling back to the key itself when missing. */
export function translate(catalog: Messages, key: string, vars?: MessageVars): string {
  const message = resolveMessage(catalog, key);
  if (message === undefined) return key;
  if (typeof message === 'function') return message(vars ?? {});
  if (!vars) return message;

  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: MessageVars) => string;
};

// Defaulting to the English catalog keeps components usable (and readable in
// tests) without a provider.
export const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  setLanguage: () => undefined,
  t: (key, vars) => translate(en, key, vars),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => detectLanguage());

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage can be unavailable; the in-memory language still applies.
    }
  }, [language]);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);

  const t = useCallback(
    (key: string, vars?: MessageVars) => translate(CATALOGS[language] ?? en, key, vars),
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  return useContext(I18nContext);
}

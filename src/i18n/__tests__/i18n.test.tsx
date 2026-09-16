import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider, useTranslation } from '../index';
import { isLanguage, translate } from '../I18nContext';
import { en } from '../locales/en';

function Probe() {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="save">{t('header.save')}</span>
      <span data-testid="page">{t('statusBar.pageNumber', { page: 3 })}</span>
      <span data-testid="missing">{t('does.not.exist')}</span>
      <button type="button" onClick={() => setLanguage('vi')}>
        switch
      </button>
    </div>
  );
}

describe('i18n', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, 'language', { value: 'en-US', configurable: true });
  });

  it('defaults to English, interpolates, and switches to Vietnamese', async () => {
    window.localStorage.clear();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('en');
    expect(screen.getByTestId('save')).toHaveTextContent('Save');
    expect(screen.getByTestId('page')).toHaveTextContent('Page 3');

    await user.click(screen.getByRole('button', { name: /switch/i }));

    expect(screen.getByTestId('language')).toHaveTextContent('vi');
    expect(screen.getByTestId('save')).toHaveTextContent('Lưu');
    expect(screen.getByTestId('page')).toHaveTextContent('Trang 3');
    expect(document.documentElement.lang).toBe('vi');
  });

  it('returns the key itself when a message is missing', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId('missing')).toHaveTextContent('does.not.exist');
  });
});

describe('isLanguage', () => {
  it('accepts only supported locale codes', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('vi')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(null)).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});

describe('detectLanguage preference order', () => {
  it('prefers the stored language over the browser language', () => {
    window.localStorage.setItem('docxcraft:language', 'vi');

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('vi');
  });

  it('falls back to the browser language when nothing is stored', () => {
    window.localStorage.clear();
    Object.defineProperty(window.navigator, 'language', { value: 'vi-VN', configurable: true });

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('vi');

    Object.defineProperty(window.navigator, 'language', { value: 'en-US', configurable: true });
  });

  it('falls back to English when storage throws and the browser is not Vietnamese', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
    Object.defineProperty(window.navigator, 'language', { value: 'en-US', configurable: true });

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('en');

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('keeps the language in memory when persisting throws', async () => {
    window.localStorage.clear();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: /switch/i }));

    expect(screen.getByTestId('language')).toHaveTextContent('vi');

    setItem.mockRestore();
  });
});

describe('translate', () => {
  it('invokes function messages with the provided vars', () => {
    const message = translate(
      { fn: (vars: Record<string, unknown>) => `hi ${String(vars.name)}` } as never,
      'fn',
      { name: 'An' },
    );

    expect(message).toBe('hi An');
  });

  it('keeps unknown placeholders and resolves nested keys', () => {
    expect(
      translate({ greet: 'Page {page} of {total}' } as never, 'greet', { page: 2 } as never),
    ).toBe('Page 2 of {total}');
    expect(translate(en, 'statusBar.pageNumber', { page: 3 } as never)).toBe('Page 3');
    expect(translate(en, 'header' as never)).toBe('header');
    expect(translate(en, 'statusBar.pageNumber.missing.deep')).toBe(
      'statusBar.pageNumber.missing.deep',
    );
    expect(translate(en, 'header.save', { extra: 1 } as never)).toBe('Save');
  });
});


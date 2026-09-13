import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { I18nProvider, useTranslation } from '../index';

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

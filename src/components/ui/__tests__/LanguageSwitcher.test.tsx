import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { I18nProvider } from '../../../i18n';
import { LanguageSwitcher } from '../LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('lists both languages and switches the active locale', async () => {
    window.localStorage.clear();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>,
    );

    const trigger = screen.getByRole('button', { name: /switch language/i });
    expect(trigger).toHaveTextContent('EN');

    await user.click(trigger);

    const vietnamese = screen.getByRole('menuitemradio', { name: 'Tiếng Việt' });
    expect(vietnamese).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(vietnamese);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đổi ngôn ngữ/i })).toHaveTextContent('VI');
    expect(document.documentElement.lang).toBe('vi');
  });
});

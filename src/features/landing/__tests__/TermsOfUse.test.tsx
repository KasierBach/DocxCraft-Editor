import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../../i18n';
import { TermsOfUse } from '../TermsOfUse';

describe('TermsOfUse', () => {
  it('renders the terms and returns on back', async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <I18nProvider>
        <TermsOfUse onBack={onBack} />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

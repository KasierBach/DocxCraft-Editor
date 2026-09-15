import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../../i18n';
import { GuestBanner } from '../GuestBanner';

describe('GuestBanner', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('offers sign-in and can be dismissed for the session', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();

    render(
      <I18nProvider>
        <GuestBanner providers={[{ id: 'google', label: 'Google' }]} onSignIn={onSignIn} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('docxcraft:guest-banner-dismissed')).toBe('1');
  });

  it('renders nothing when no providers are configured', () => {
    const { container } = render(
      <I18nProvider>
        <GuestBanner providers={[]} onSignIn={vi.fn()} />
      </I18nProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

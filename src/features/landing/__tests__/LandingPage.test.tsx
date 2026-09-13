import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../../i18n';
import { LandingPage } from '../LandingPage';

function renderLanding() {
  const props = {
    needsSetup: true,
    onPrimaryAction: vi.fn(),
    onShowDocs: vi.fn(),
    onShowChangelog: vi.fn(),
    onShowPrivacy: vi.fn(),
    onShowTerms: vi.fn(),
  };

  const { container } = render(
    <I18nProvider>
      <LandingPage {...props} />
    </I18nProvider>,
  );

  return { props, container };
}

describe('LandingPage', () => {
  it('renders and invokes the primary action', async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const { props } = renderLanding();

    await user.click(screen.getAllByRole('button', { name: /get started/i })[0]);

    expect(props.onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it('switches the whole page to Vietnamese from the nav switcher', async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    renderLanding();

    await user.click(screen.getByRole('button', { name: /switch language/i }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Tiếng Việt' }));

    expect(document.documentElement.lang).toBe('vi');
    expect(screen.getByRole('button', { name: /đổi ngôn ngữ/i })).toBeInTheDocument();
  });

  it('wires the nav and footer to the reference pages', async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const { props, container } = renderLanding();

    for (const button of container.querySelectorAll<HTMLButtonElement>('.landing-nav button')) {
      await user.click(button);
    }

    const footer = screen.getByRole('contentinfo');
    for (const button of within(footer).getAllByRole('button')) {
      await user.click(button);
    }

    expect(props.onShowDocs).toHaveBeenCalled();
    expect(props.onShowChangelog).toHaveBeenCalled();
    expect(props.onShowPrivacy).toHaveBeenCalled();
    expect(props.onShowTerms).toHaveBeenCalled();
  });
});

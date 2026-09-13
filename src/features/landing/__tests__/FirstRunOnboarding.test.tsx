import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { FirstRunOnboarding } from '../FirstRunOnboarding';

const STORAGE_KEY = 'docxcraft:onboarded';

describe('FirstRunOnboarding', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('shows the tour on a first visit', () => {
    render(<FirstRunOnboarding />);

    expect(screen.getByRole('dialog', { name: /welcome to docx workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/open something/i)).toBeInTheDocument();
  });

  it('stays hidden once the tour has been completed', () => {
    window.localStorage.setItem(STORAGE_KEY, 'done');
    render(<FirstRunOnboarding />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('walks through the steps and remembers completion', async () => {
    const user = userEvent.setup();
    render(<FirstRunOnboarding />);

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/navigate with the anchor map/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/nothing gets lost/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start editing/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('done');
  });

  it('dismisses with Skip and remembers it', async () => {
    const user = userEvent.setup();
    render(<FirstRunOnboarding />);

    await user.click(screen.getByRole('button', { name: /skip/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('done');
  });
});

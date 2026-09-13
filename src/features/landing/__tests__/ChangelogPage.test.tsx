import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChangelogPage } from '../../landing/ChangelogPage';

describe('ChangelogPage', () => {
  it('renders the release history', () => {
    render(<ChangelogPage onBack={() => undefined} />);

    expect(screen.getByRole('heading', { name: /^changelog$/i })).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
    expect(screen.getByText('First public release')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /security/i })).toBeInTheDocument();
    expect(screen.getByText(/zip-bomb-hardened upload validation/i)).toBeInTheDocument();
  });

  it('navigates back to the landing page', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();

    render(<ChangelogPage onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /back to home/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

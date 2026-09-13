import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DocsPage } from '../../landing/DocsPage';

describe('DocsPage', () => {
  it('renders quick start, configuration, and shortcuts', () => {
    render(<DocsPage onBack={() => undefined} />);

    expect(screen.getByRole('heading', { name: /^docs$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /quick start/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /keyboard shortcuts/i })).toBeInTheDocument();
    expect(screen.getByText(/docker run/)).toBeInTheDocument();
    expect(screen.getByText('AUTH_MODE')).toBeInTheDocument();
    expect(screen.getByText('AUTH_STATE_FILE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /getting help/i })).toBeInTheDocument();
    expect(screen.getByText('Ctrl + P')).toBeInTheDocument();
  });

  it('navigates back to the landing page', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();

    render(<DocsPage onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /back to home/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

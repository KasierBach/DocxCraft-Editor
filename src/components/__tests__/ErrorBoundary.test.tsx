import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('leaves a healthy child usable without displaying a recovery screen', () => {
    render(<ErrorBoundary><input aria-label="Document title" defaultValue="Draft" /></ErrorBoundary>);
    expect(screen.getByRole('textbox', { name: 'Document title' })).toHaveValue('Draft');
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('renders a child error as inert text and retries mounting the child', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let broken = true;
    function Child() {
      if (broken) throw new Error('<img src=x onerror=alert(1)>');
      return <input aria-label="Recovered editor" defaultValue="Available" />;
    }
    const user = userEvent.setup();
    const { container } = render(<ErrorBoundary><Child /></ErrorBoundary>);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    broken = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByRole('textbox', { name: 'Recovered editor' })).toHaveValue('Available');
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});

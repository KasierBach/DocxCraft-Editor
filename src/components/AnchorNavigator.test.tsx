import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnchorNavigator } from './AnchorNavigator';

describe('AnchorNavigator', () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  it('renders a button for each anchor and jumps with the right paraId', async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();

    render(
      <AnchorNavigator
        anchors={[
          {
            id: 'A1000001',
            label: 'Overview',
            pageNumber: 1,
            paragraphIndex: 0,
            styleId: 'Heading1',
          },
          {
            id: 'A1000003',
            label: 'Implementation details',
            pageNumber: 1,
            paragraphIndex: 1,
            styleId: undefined,
          },
        ]}
        activeParaId="A1000003"
        onJump={onJump}
      />,
    );

    await user.click(screen.getByRole('button', { name: /overview/i }));

    expect(onJump).toHaveBeenCalledWith('A1000001');
    expect(screen.getByRole('button', { name: /implementation details/i })).toHaveAttribute(
      'data-active',
      'true',
    );
  });

  it('auto-scrolls the active anchor into view when selection changes elsewhere', () => {
    const anchors = [
      {
        id: 'A1000001',
        label: 'Overview',
        pageNumber: 1,
        paragraphIndex: 0,
        styleId: 'Heading1',
      },
      {
        id: 'A1000003',
        label: 'Implementation details',
        pageNumber: 1,
        paragraphIndex: 1,
        styleId: undefined,
      },
    ];

    const { rerender } = render(
      <AnchorNavigator anchors={anchors} activeParaId="A1000001" onJump={vi.fn()} />,
    );

    scrollIntoViewMock.mockClear();

    rerender(<AnchorNavigator anchors={anchors} activeParaId="A1000003" onJump={vi.fn()} />);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  });
});

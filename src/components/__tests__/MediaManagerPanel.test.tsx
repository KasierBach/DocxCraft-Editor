import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { MediaItem } from '../../lib/mediaScanner';
import { MediaManagerPanel } from '../MediaManagerPanel';

vi.mock('../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) =>
      key === 'documents.mediaTitleCount' ? `Media (${values?.count ?? 0})` : key === 'documents.paragraph' ? `Paragraph ${values?.index ?? 0}` : key,
  }),
}));

vi.mock('../ui/Panel', () => ({
  Panel: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

describe('MediaManagerPanel', () => {
  it('forwards the full media item so the editor can use its anchor or position', async () => {
    const item: MediaItem = {
      id: 'image-1',
      type: 'image',
      label: 'Chart overview',
      paraId: null,
      position: 12,
      paragraphIndex: 3,
    };
    const onJumpToMedia = vi.fn();
    const user = userEvent.setup();

    render(<MediaManagerPanel items={[item]} onJumpToMedia={onJumpToMedia} />);
    await user.click(screen.getByRole('button', { name: /Chart overview/i }));

    expect(onJumpToMedia).toHaveBeenCalledWith(item);
  });
});

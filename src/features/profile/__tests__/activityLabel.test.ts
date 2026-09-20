import { describe, expect, it } from 'vitest';

import { translate, type MessageVars } from '../../../i18n';
import { en } from '../../../i18n/locales/en';
import type { ActivityEvent } from '../../../lib/accountApi';
import { activityLabel } from '../activityLabel';

const t = (key: string, vars?: MessageVars) => translate(en, key, vars);

function makeEvent(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: 'e1',
    action: 'document.update',
    documentId: null,
    metadata: null,
    createdAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('activityLabel', () => {
  it('renders both names for a rename with metadata', () => {
    const event = makeEvent({
      action: 'document.rename',
      metadata: { previousName: 'Bob.docx', newName: 'Bob Q3.docx' },
    });

    expect(activityLabel(event, t)).toBe('Renamed Bob.docx → Bob Q3.docx');
  });

  it('falls back when rename metadata is absent or malformed', () => {
    expect(activityLabel(makeEvent({ action: 'document.rename' }), t)).toBe('Renamed a document');
    expect(
      activityLabel(
        makeEvent({ action: 'document.rename', metadata: JSON.parse('{}') as ActivityEvent['metadata'] }),
        t,
      ),
    ).toBe('Renamed a document');
  });

  it('labels known actions and ignores metadata for them', () => {
    expect(activityLabel(makeEvent({ action: 'document.create' }), t)).toBe('Created a document');
    expect(activityLabel(makeEvent({ action: 'account.sign_in' }), t)).toBe('Signed in');
  });

  it.each([
    ['document.update', 'Saved a document'],
    ['document.delete', 'Deleted a document'],
    ['document.restore', 'Restored a document'],
    ['document.purge', 'Permanently deleted a document'],
    ['document.duplicate', 'Duplicated a document'],
    ['account.export', 'Exported account data'],
    ['account.delete', 'Deleted the account'],
    ['account.profile_update', 'Updated the display name'],
    ['account.provider_disconnect', 'Disconnected a sign-in provider'],
  ] as const)('labels %s', (action, expected) => {
    expect(activityLabel(makeEvent({ action }), t)).toBe(expected);
  });

  it('falls back when rename names are empty', () => {
    expect(
      activityLabel(
        makeEvent({ action: 'document.rename', metadata: { previousName: '', newName: 'Renamed.docx' } }),
        t,
      ),
    ).toBe('Renamed a document');
  });

  it('tolerates an action the client does not know', () => {
    expect(activityLabel(makeEvent({ action: 'future.something' }), t)).toBe('Account activity');
  });
});

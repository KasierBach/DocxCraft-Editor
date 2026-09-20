// @vitest-environment node
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from '../generated/prisma/client.ts';
import { WorkspaceService } from '../workspace.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

const TRUNCATE =
  'truncate "users", "oauth_accounts", "sessions", "documents", "document_versions", "audit_events", "document_shares", "document_comments", "api_tokens", "notifications", "ai_preferences", "ai_usage" cascade';

describe.skipIf(!databaseUrl)('WorkspaceService (integration)', () => {
  let prisma: PrismaClient;
  let workspace: WorkspaceService;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for workspace tests.');
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    workspace = new WorkspaceService({ prisma });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await releaseLock();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
  });

  async function fixture() {
    const owner = await prisma.user.create({ data: { email: 'owner@example.com', name: 'Owner' } });
    const reviewer = await prisma.user.create({ data: { email: 'reviewer@example.com', name: 'Reviewer' } });
    const now = new Date();
    const document = await prisma.document.create({
      data: {
        ownerId: owner.id,
        name: 'Report.docx',
        sizeInBytes: 10,
        versionCount: 1,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        searchText: 'quarterly report',
      },
    });
    return { owner, reviewer, document };
  }

  it('covers search, metadata, sharing, comments, notifications, tokens, and AI quota', async () => {
    const { owner, reviewer, document } = await fixture();

    expect((await workspace.listDocuments(owner.id, { query: 'quarterly' }))[0]?.id).toBe(document.id);
    expect(await workspace.usage(owner.id)).toEqual({ documents: 1, bytes: 10 });
    expect((await workspace.updateMetadata(owner.id, document.id, { folder: 'Reports', tags: ['q1', 'q1'], isStarred: true })).tags).toEqual(['q1']);
    expect(await workspace.bulkUpdate(owner.id, [document.id], { folder: 'Archive' })).toEqual({ updated: 1 });

    const share = await workspace.upsertShare(owner.id, document.id, reviewer.email!, 'viewer');
    expect((await workspace.listDocuments(reviewer.id))[0]?.role).toBe('viewer');
    expect((await workspace.listShares(owner.id, document.id))[0]?.email).toBe(reviewer.email);

    const comment = await workspace.addComment(reviewer.id, document.id, { body: 'Please review this.', paraId: 'p-1' });
    expect(comment.authorName).toBe('Reviewer');
    expect((await workspace.listComments(owner.id, document.id)).length).toBe(1);
    await expect(workspace.resolveComment(reviewer.id, comment.id, true)).rejects.toMatchObject({ statusCode: 403 });
    expect((await workspace.resolveComment(owner.id, comment.id, true)).resolvedAt).not.toBeNull();
    expect((await workspace.listNotifications(owner.id)).some((entry) => entry.type === 'comment.added')).toBe(true);
    await workspace.markNotificationsRead(owner.id);
    expect((await workspace.listNotifications(owner.id)).every((entry) => entry.readAt)).toBe(true);

    await workspace.deleteShare(owner.id, document.id, share.id);
    expect(await workspace.listShares(owner.id, document.id)).toHaveLength(0);

    const createdToken = await workspace.createApiToken(owner.id, 'CLI');
    expect(await workspace.resolveApiToken(createdToken.token)).toBe(owner.id);
    await workspace.revokeApiToken(owner.id, createdToken.id);
    expect(await workspace.resolveApiToken(createdToken.token)).toBeNull();

    await workspace.updateAiPreference(owner.id, { model: 'test-model', enabled: true });
    expect((await workspace.getAiPreference(owner.id)).model).toBe('test-model');
    await expect(workspace.consumeAiQuota(owner.id, 1)).resolves.toMatchObject({ requests: 1 });
    await expect(workspace.consumeAiQuota(owner.id, 1)).rejects.toMatchObject({ statusCode: 429 });
    expect((await workspace.aiUsage(owner.id)).requests).toBe(1);
  });
});

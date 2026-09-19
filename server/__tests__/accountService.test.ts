// @vitest-environment node
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccountService } from '../accountService.ts';
import { PrismaClient } from '../generated/prisma/client.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const hasDatabase = Boolean(databaseUrl);

const TRUNCATE =
  'truncate "users", "oauth_accounts", "sessions", "documents", "document_versions", "audit_events" cascade';

// Skipped unless TEST_DATABASE_URL is set; expects migrations applied.
describe.skipIf(!hasDatabase)('AccountService (integration)', () => {
  let prisma: PrismaClient;
  let accounts: AccountService;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for the account tests.');
    }
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    accounts = new AccountService({ prisma });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await releaseLock();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
  });

  function googleProfile(overrides: Partial<Parameters<AccountService['findOrCreateUserFromProfile']>[0]> = {}) {
    return {
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'user@example.com',
      emailVerified: true,
      name: 'Test User',
      avatarUrl: 'https://example.com/a.png',
      ...overrides,
    };
  }

  function createDocument(ownerId: string, name: string) {
    const now = new Date();
    return prisma.document.create({
      data: { ownerId, name, sizeInBytes: 3, versionCount: 0, revision: 1, createdAt: now, updatedAt: now },
    });
  }

  it('creates an anonymous guest', async () => {
    const { id: guestId, createdAt } = await accounts.createGuest();

    const guest = await prisma.user.findUniqueOrThrow({ where: { id: guestId } });
    expect(guest.isAnonymous).toBe(true);
    expect(guest.email).toBeNull();
    expect(createdAt).toEqual(guest.createdAt);
  });

  it('creates a user and linked account from an OAuth profile', async () => {
    const result = await accounts.findOrCreateUserFromProfile(googleProfile());

    expect(result.created).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.isAnonymous).toBe(false);
    expect(user.email).toBe('user@example.com');
    expect(await prisma.oAuthAccount.count({ where: { userId: result.userId } })).toBe(1);
  });

  it('is idempotent for the same provider account', async () => {
    const first = await accounts.findOrCreateUserFromProfile(googleProfile());
    const second = await accounts.findOrCreateUserFromProfile(googleProfile({ name: 'Updated Name' }));

    expect(second.userId).toBe(first.userId);
    expect(second.created).toBe(false);
    expect(await prisma.user.count()).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: first.userId } });
    expect(user.name).toBe('Updated Name');
  });

  it('links to an existing user matched by email (case-insensitive)', async () => {
    const existing = await prisma.user.create({
      data: { email: 'user@example.com', isAnonymous: false },
    });

    const result = await accounts.findOrCreateUserFromProfile(
      googleProfile({ provider: 'github', providerAccountId: 'gh-1', email: 'USER@example.com' }),
    );

    expect(result.userId).toBe(existing.id);
    expect(result.created).toBe(false);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.oAuthAccount.count({ where: { userId: existing.id } })).toBe(1);
  });

  it('moves a guest’s documents to the account and removes the guest', async () => {
    const { id: guestId } = await accounts.createGuest();
    await createDocument(guestId, 'Guest doc.docx');
    await prisma.session.create({
      data: { userId: guestId, tokenHash: 'guest-token', expiresAt: new Date(Date.now() + 60_000) },
    });
    const signedIn = await accounts.findOrCreateUserFromProfile(googleProfile());

    const moved = await accounts.mergeGuestIntoUser(guestId, signedIn.userId);

    expect(moved).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: guestId } })).toBeNull();
    expect(await prisma.session.count({ where: { userId: guestId } })).toBe(0);
    const documents = await prisma.document.findMany();
    expect(documents).toHaveLength(1);
    expect(documents[0]?.ownerId).toBe(signedIn.userId);
  });

  it('does not merge a non-anonymous user', async () => {
    const a = await prisma.user.create({ data: { email: 'a@example.com' } });
    const b = await prisma.user.create({ data: { email: 'b@example.com' } });

    expect(await accounts.mergeGuestIntoUser(a.id, b.id)).toBe(0);
    expect(await prisma.user.count()).toBe(2);
  });

  it('lists linked providers and protects the last sign-in method', async () => {
    const { userId } = await accounts.findOrCreateUserFromProfile(googleProfile());
    await accounts.findOrCreateUserFromProfile(
      googleProfile({ provider: 'github', providerAccountId: 'gh-1' }),
    );

    const linked = await accounts.listLinkedProviders(userId);
    expect(linked.map((entry) => entry.provider)).toEqual(['google', 'github']);

    expect(await accounts.disconnectProvider(userId, 'github', { isAnonymous: false })).toBe(
      'disconnected',
    );
    expect(await accounts.disconnectProvider(userId, 'github', { isAnonymous: false })).toBe(
      'not-linked',
    );
    expect(await accounts.disconnectProvider(userId, 'google', { isAnonymous: false })).toBe(
      'last-method',
    );
    expect(
      (await accounts.listLinkedProviders(userId)).map((entry) => entry.provider),
    ).toEqual(['google']);
  });

  it('lets an anonymous guest unlink its only provider', async () => {
    const { id: guestId } = await accounts.createGuest();
    await prisma.oAuthAccount.create({
      data: { userId: guestId, provider: 'google', providerAccountId: 'guest-google' },
    });

    expect(await accounts.disconnectProvider(guestId, 'google', { isAnonymous: true })).toBe(
      'disconnected',
    );
    expect(await accounts.listLinkedProviders(guestId)).toEqual([]);
  });
});

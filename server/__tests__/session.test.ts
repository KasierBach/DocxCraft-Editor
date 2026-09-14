// @vitest-environment node
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from '../generated/prisma/client.ts';
import { SessionService, hashSessionToken } from '../session.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const hasDatabase = Boolean(databaseUrl);

// Skipped unless TEST_DATABASE_URL is set; expects migrations applied.
describe.skipIf(!hasDatabase)('SessionService (integration)', () => {
  let prisma: PrismaClient;
  let sessions: SessionService;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for the session tests.');
    }
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    sessions = new SessionService({ prisma, ttlMs: 60_000 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await releaseLock();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('truncate "users", "sessions" cascade');
  });

  function createUser() {
    return prisma.user.create({ data: { email: `${Math.random()}@example.com` } });
  }

  it('creates and resolves a session', async () => {
    const user = await createUser();
    const { token } = await sessions.createForUser(user.id, { ip: '127.0.0.1' });

    const resolved = await sessions.resolve(token);

    expect(resolved?.user.id).toBe(user.id);
    expect(resolved?.user.isAnonymous).toBe(false);
  });

  it('stores only a hash of the token', async () => {
    const user = await createUser();
    const { token } = await sessions.createForUser(user.id);

    const row = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });

    expect(row.tokenHash).toBe(hashSessionToken(token));
    expect(row.tokenHash).not.toBe(token);
  });

  it('rejects unknown and expired tokens', async () => {
    expect(await sessions.resolve('not-a-real-token')).toBeNull();
    expect(await sessions.resolve(undefined)).toBeNull();

    const user = await createUser();
    const { token } = await sessions.createForUser(user.id);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await sessions.resolve(token)).toBeNull();
  });

  it('revokes a single session and all sessions for a user', async () => {
    const user = await createUser();
    const first = await sessions.createForUser(user.id);
    const second = await sessions.createForUser(user.id);

    await sessions.revoke(first.token);
    expect(await sessions.resolve(first.token)).toBeNull();
    expect(await sessions.resolve(second.token)).not.toBeNull();

    await sessions.revokeAllForUser(user.id);
    expect(await sessions.resolve(second.token)).toBeNull();
  });

  it('rejects sessions belonging to a soft-deleted user', async () => {
    const user = await createUser();
    const { token } = await sessions.createForUser(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

    expect(await sessions.resolve(token)).toBeNull();
  });
});

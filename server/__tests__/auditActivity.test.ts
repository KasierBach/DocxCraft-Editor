// @vitest-environment node
import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ACTIVITY_DEFAULT_LIMIT, AuditService } from '../audit.ts';
import { PrismaClient } from '../generated/prisma/client.ts';
import { acquireDatabaseLock } from './support/databaseLock.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;
const hasDatabase = Boolean(databaseUrl);

const TRUNCATE =
  'truncate "users", "oauth_accounts", "sessions", "documents", "document_versions", "audit_events" cascade';

// Skipped unless TEST_DATABASE_URL is set; expects migrations applied.
describe.skipIf(!hasDatabase)('AuditService.listForActor (integration)', () => {
  let prisma: PrismaClient;
  let audit: AuditService;
  let releaseLock: () => Promise<void>;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for the audit activity tests.');
    }
    releaseLock = await acquireDatabaseLock(databaseUrl);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    audit = new AuditService({ prisma });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await releaseLock();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
  });

  function createUser() {
    return prisma.user.create({ data: { email: `${randomUUID()}@example.com` } });
  }

  function createEvent(actorUserId: string, createdAt: Date, action: string) {
    return prisma.auditEvent.create({ data: { actorUserId, action, createdAt } });
  }

  it("returns only the actor's events, newest first", async () => {
    const actor = await createUser();
    const other = await createUser();
    const base = Date.now();

    await createEvent(actor.id, new Date(base - 2_000), 'actor.oldest');
    await createEvent(actor.id, new Date(base - 1_000), 'actor.middle');
    await createEvent(actor.id, new Date(base), 'actor.newest');
    await createEvent(other.id, new Date(base), 'other.event');

    const page = await audit.listForActor({ actorUserId: actor.id });

    expect(page.events.map((event) => event.action)).toEqual([
      'actor.newest',
      'actor.middle',
      'actor.oldest',
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('defaults to ACTIVITY_DEFAULT_LIMIT and honours a custom limit', async () => {
    const actor = await createUser();
    const base = Date.now();
    for (let index = 0; index < 25; index += 1) {
      await createEvent(actor.id, new Date(base - index * 1_000), `event.${index}`);
    }

    const defaulted = await audit.listForActor({ actorUserId: actor.id });
    expect(defaulted.events).toHaveLength(ACTIVITY_DEFAULT_LIMIT);

    const limited = await audit.listForActor({ actorUserId: actor.id, limit: 2 });
    expect(limited.events).toHaveLength(2);
    expect(limited.events.map((event) => event.action)).toEqual(['event.0', 'event.1']);
    expect(limited.nextCursor).toBe(limited.events[1]?.createdAt);
  });

  it('pages with the cursor over strictly older events without repeats', async () => {
    const actor = await createUser();
    const base = Date.now();
    for (let index = 0; index < 5; index += 1) {
      await createEvent(actor.id, new Date(base - index * 1_000), `event.${index}`);
    }

    const first = await audit.listForActor({ actorUserId: actor.id, limit: 2 });
    expect(first.events).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await audit.listForActor({
      actorUserId: actor.id,
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.events).toHaveLength(2);

    const third = await audit.listForActor({
      actorUserId: actor.id,
      limit: 2,
      cursor: second.nextCursor,
    });
    expect(third.events).toHaveLength(1);
    expect(third.nextCursor).toBeNull();

    const pages = [...first.events, ...second.events, ...third.events];
    expect(new Set(pages.map((event) => event.id)).size).toBe(5);
    expect(pages.map((event) => event.action)).toEqual([
      'event.0',
      'event.1',
      'event.2',
      'event.3',
      'event.4',
    ]);

    for (const event of second.events) {
      expect(Date.parse(event.createdAt)).toBeLessThan(Date.parse(first.nextCursor as string));
    }
    for (const event of third.events) {
      expect(Date.parse(event.createdAt)).toBeLessThan(Date.parse(second.nextCursor as string));
    }
  });

  it('attributes recorded events to the actor', async () => {
    const actor = await createUser();

    await audit.record({
      action: 'account.profile_update',
      actorUserId: actor.id,
      ip: '127.0.0.1',
    });

    const page = await audit.listForActor({ actorUserId: actor.id });
    expect(page.events).toHaveLength(1);
    expect(page.events[0]?.action).toBe('account.profile_update');
    expect(page.events[0]?.metadata).toBeNull();
  });

  it('round-trips rename metadata and treats legacy rows as null', async () => {
    const actor = await createUser();

    await createEvent(actor.id, new Date(Date.now() - 60_000), 'document.rename');
    await audit.record({
      action: 'document.rename',
      actorUserId: actor.id,
      metadata: { previousName: 'Bob.docx', newName: 'Bob Q3.docx' },
    });

    const page = await audit.listForActor({ actorUserId: actor.id });

    expect(page.events[0]?.metadata).toEqual({
      previousName: 'Bob.docx',
      newName: 'Bob Q3.docx',
    });
    expect(page.events[1]?.metadata).toBeNull();
  });
});

import type { Prisma, PrismaClient } from './generated/prisma/client.ts';

export type AuditAction =
  | 'document.create'
  | 'document.update'
  | 'document.rename'
  | 'document.delete'
  | 'document.restore'
  | 'document.purge'
  | 'document.duplicate'
  | 'account.sign_in'
  | 'account.export'
  | 'account.delete'
  | 'account.profile_update'
  | 'account.provider_disconnect';

export const ACTIVITY_DEFAULT_LIMIT = 20;
export const ACTIVITY_MAX_LIMIT = 50;

/**
 * Action-specific detail. Only rename carries it today; the shape stays a
 * single object so adding another action's detail widens rather than reshapes.
 */
export type AuditEventMetadata = {
  previousName: string;
  newName: string;
};

/** Rows written before the metadata column existed, or by another writer, may not match. */
function readMetadata(value: Prisma.JsonValue | null): AuditEventMetadata | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const { previousName, newName } = value as Record<string, unknown>;
  return typeof previousName === 'string' && typeof newName === 'string'
    ? { previousName, newName }
    : null;
}

/** One row of a user's own activity feed. */
export type AuditActivityItem = {
  id: string;
  action: string;
  documentId: string | null;
  metadata: AuditEventMetadata | null;
  createdAt: string;
};

export type AuditActivityPage = {
  events: AuditActivityItem[];
  nextCursor: string | null;
};

/**
 * Append-only audit trail. Recording is best-effort: an audit failure must
 * never fail the request it describes.
 */
export class AuditService {
  private readonly prisma: PrismaClient;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  async record(input: {
    action: AuditAction;
    actorUserId?: string | null;
    documentId?: string | null;
    ip?: string | null;
    metadata?: AuditEventMetadata | null;
  }) {
    try {
      await this.prisma.auditEvent.create({
        data: {
          action: input.action,
          actorUserId: input.actorUserId ?? null,
          documentId: input.documentId ?? null,
          ip: input.ip ?? null,
          ...(input.metadata ? { metadata: input.metadata } : {}),
        },
      });
    } catch (error) {
      console.error('Failed to record audit event', error);
    }
  }

  /**
   * One actor's own events, newest first. The `actorUserId` filter is the
   * privacy boundary: these rows sit in a table shared with every other user's
   * events, so a query without it would leak them. Unlike recording, a read
   * failure is allowed to surface.
   */
  async listForActor({
    actorUserId,
    cursor,
    limit = ACTIVITY_DEFAULT_LIMIT,
  }: {
    actorUserId: string;
    cursor?: string | null;
    limit?: number;
  }): Promise<AuditActivityPage> {
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        actorUserId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const events = rows.map((row) => ({
      id: row.id,
      action: row.action,
      documentId: row.documentId,
      metadata: readMetadata(row.metadata),
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      events,
      // A short page means there is nothing left behind it.
      nextCursor: rows.length === limit ? (events.at(-1)?.createdAt ?? null) : null,
    };
  }
}

import type { PrismaClient } from './generated/prisma/client.ts';

export type AuditAction =
  | 'document.create'
  | 'document.update'
  | 'document.rename'
  | 'document.delete'
  | 'document.duplicate'
  | 'account.sign_in'
  | 'account.export'
  | 'account.delete';

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
  }) {
    try {
      await this.prisma.auditEvent.create({
        data: {
          action: input.action,
          actorUserId: input.actorUserId ?? null,
          documentId: input.documentId ?? null,
          ip: input.ip ?? null,
        },
      });
    } catch (error) {
      console.error('Failed to record audit event', error);
    }
  }
}

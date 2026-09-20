import { createHash, randomBytes } from 'node:crypto';

import type { PrismaClient } from './generated/prisma/client.ts';

export type ShareRole = 'viewer' | 'editor';

export class WorkspaceError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'WorkspaceError';
    this.statusCode = statusCode;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function documentView(row: {
  id: string;
  name: string;
  folder: string | null;
  tags: string[];
  isStarred: boolean;
  updatedAt: Date;
  sizeInBytes: bigint;
  role?: string;
}) {
  return {
    id: row.id,
    name: row.name,
    folder: row.folder,
    tags: row.tags,
    isStarred: row.isStarred,
    updatedAt: row.updatedAt.toISOString(),
    sizeInBytes: Number(row.sizeInBytes),
    role: row.role ?? 'owner',
  };
}

function commentView(row: {
  id: string;
  documentId: string;
  authorId: string;
  parentId: string | null;
  paraId: string | null;
  body: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string | null; email: string | null };
}) {
  return {
    id: row.id,
    documentId: row.documentId,
    authorId: row.authorId,
    authorName: row.author.name ?? row.author.email ?? 'Anonymous',
    parentId: row.parentId,
    paraId: row.paraId,
    body: row.body,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class WorkspaceService {
  private readonly prisma: PrismaClient;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  async listDocuments(userId: string, options: { query?: string; folder?: string; tag?: string; starred?: boolean } = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const query = options.query?.trim();
    const owned = await this.prisma.document.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        ...(options.folder ? { folder: options.folder } : {}),
        ...(options.tag ? { tags: { has: options.tag } } : {}),
        ...(options.starred === undefined ? {} : { isStarred: options.starred }),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { searchText: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    const shared = user?.email
      ? await this.prisma.documentShare.findMany({
          where: {
            email: normalizeEmail(user.email),
            document: {
              deletedAt: null,
              ...(options.folder ? { folder: options.folder } : {}),
              ...(options.tag ? { tags: { has: options.tag } } : {}),
              ...(options.starred === undefined ? {} : { isStarred: options.starred }),
              ...(query
                ? {
                    OR: [
                      { name: { contains: query, mode: 'insensitive' } },
                      { searchText: { contains: query, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
          },
          include: { document: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return [
      ...owned.map((row) => documentView(row)),
      ...shared.map((row) => documentView({ ...row.document, role: row.role })),
    ];
  }

  async usage(userId: string) {
    const [count, total] = await Promise.all([
      this.prisma.document.count({ where: { ownerId: userId, deletedAt: null } }),
      this.prisma.document.aggregate({ where: { ownerId: userId, deletedAt: null }, _sum: { sizeInBytes: true } }),
    ]);
    return { documents: count, bytes: Number(total._sum.sizeInBytes ?? 0) };
  }

  async updateMetadata(userId: string, documentId: string, input: { folder?: string | null; tags?: string[]; isStarred?: boolean }) {
    await this.requireOwner(userId, documentId);
    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        ...(input.folder !== undefined ? { folder: input.folder?.trim() || null } : {}),
        ...(input.tags !== undefined ? { tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 30) } : {}),
        ...(input.isStarred !== undefined ? { isStarred: input.isStarred } : {}),
      },
    });
    return documentView(updated);
  }

  async bulkUpdate(userId: string, documentIds: string[], input: { folder?: string | null; isStarred?: boolean }) {
    if (documentIds.length === 0 || documentIds.length > 100) throw new WorkspaceError('Select between 1 and 100 documents.');
    const result = await this.prisma.document.updateMany({
      where: { id: { in: documentIds }, ownerId: userId, deletedAt: null },
      data: {
        ...(input.folder !== undefined ? { folder: input.folder?.trim() || null } : {}),
        ...(input.isStarred !== undefined ? { isStarred: input.isStarred } : {}),
      },
    });
    return { updated: result.count };
  }

  private async requireOwner(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({ where: { id: documentId, ownerId: userId, deletedAt: null } });
    if (!document) throw new WorkspaceError('Document not found.', 404);
    return document;
  }

  async requireAccess(userId: string, documentId: string, required: ShareRole = 'viewer') {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const owned = await this.prisma.document.findFirst({ where: { id: documentId, ownerId: userId, deletedAt: null } });
    if (owned) return { document: owned, role: 'owner' as const };
    if (!user?.email) throw new WorkspaceError('Document not found.', 404);

    const share = await this.prisma.documentShare.findFirst({
      where: { documentId, email: normalizeEmail(user.email) },
      include: { document: true },
    });
    if (!share || share.document.deletedAt) throw new WorkspaceError('Document not found.', 404);
    if (required === 'editor' && share.role !== 'editor') throw new WorkspaceError('Editor permission required.', 403);
    return { document: share.document, role: share.role as ShareRole };
  }

  async listShares(userId: string, documentId: string) {
    await this.requireOwner(userId, documentId);
    const rows = await this.prisma.documentShare.findMany({ where: { documentId }, orderBy: { createdAt: 'asc' } });
    return rows.map((row) => ({ id: row.id, email: row.email, role: row.role, createdAt: row.createdAt.toISOString() }));
  }

  async upsertShare(userId: string, documentId: string, email: string, role: ShareRole) {
    await this.requireOwner(userId, documentId);
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail.includes('@')) throw new WorkspaceError('A valid email is required.');
    if (role !== 'viewer' && role !== 'editor') throw new WorkspaceError('Role must be viewer or editor.');
    const share = await this.prisma.documentShare.upsert({
      where: { documentId_email: { documentId, email: normalizedEmail } },
      create: { documentId, email: normalizedEmail, role },
      update: { role },
    });
    const recipient = await this.prisma.user.findFirst({ where: { email: normalizedEmail, deletedAt: null } });
    if (recipient && recipient.id !== userId) {
      await this.prisma.notification.create({ data: { userId: recipient.id, type: 'document.shared', payload: { documentId, role } } });
    }
    return { id: share.id, email: share.email, role: share.role, createdAt: share.createdAt.toISOString() };
  }

  async deleteShare(userId: string, documentId: string, shareId: string) {
    await this.requireOwner(userId, documentId);
    await this.prisma.documentShare.deleteMany({ where: { id: shareId, documentId } });
  }

  async listComments(userId: string, documentId: string) {
    await this.requireAccess(userId, documentId);
    const rows = await this.prisma.documentComment.findMany({
      where: { documentId },
      include: { author: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(commentView);
  }

  async addComment(userId: string, documentId: string, input: { body: string; paraId?: string | null; parentId?: string | null }) {
    await this.requireAccess(userId, documentId, input.parentId ? 'viewer' : 'viewer');
    const body = input.body.trim();
    if (!body || body.length > 10_000) throw new WorkspaceError('Comment must be between 1 and 10,000 characters.');
    if (input.parentId) {
      const parent = await this.prisma.documentComment.findFirst({ where: { id: input.parentId, documentId } });
      if (!parent) throw new WorkspaceError('Parent comment not found.', 404);
    }
    const row = await this.prisma.documentComment.create({
      data: { documentId, authorId: userId, parentId: input.parentId ?? null, paraId: input.paraId?.trim() || null, body },
      include: { author: { select: { name: true, email: true } } },
    });
    const document = await this.prisma.document.findUnique({ where: { id: documentId }, select: { ownerId: true } });
    if (document?.ownerId && document.ownerId !== userId) {
      await this.prisma.notification.create({ data: { userId: document.ownerId, type: 'comment.added', payload: { documentId, commentId: row.id } } });
    }
    return commentView(row);
  }

  async resolveComment(userId: string, commentId: string, resolved: boolean) {
    const comment = await this.prisma.documentComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new WorkspaceError('Comment not found.', 404);
    await this.requireAccess(userId, comment.documentId, 'editor');
    const row = await this.prisma.documentComment.update({
      where: { id: commentId },
      data: { resolvedAt: resolved ? new Date() : null },
      include: { author: { select: { name: true, email: true } } },
    });
    return commentView(row);
  }

  async listNotifications(userId: string) {
    const rows = await this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((row) => ({ id: row.id, type: row.type, payload: row.payload, readAt: row.readAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() }));
  }

  async markNotificationsRead(userId: string, ids?: string[]) {
    await this.prisma.notification.updateMany({ where: { userId, ...(ids?.length ? { id: { in: ids } } : { readAt: null }) }, data: { readAt: new Date() } });
  }

  async createApiToken(userId: string, name: string, expiresAt?: Date | null) {
    const token = `dxc_${randomBytes(32).toString('base64url')}`;
    const row = await this.prisma.apiToken.create({
      data: { userId, name: name.trim().slice(0, 80) || 'API token', tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: expiresAt ?? null },
    });
    return { id: row.id, name: row.name, token, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null };
  }

  async listApiTokens(userId: string) {
    const rows = await this.prisma.apiToken.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt?.toISOString() ?? null, expiresAt: row.expiresAt?.toISOString() ?? null }));
  }

  async revokeApiToken(userId: string, tokenId: string) {
    await this.prisma.apiToken.updateMany({ where: { id: tokenId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async resolveApiToken(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = await this.prisma.apiToken.findUnique({ where: { tokenHash } });
    if (!row || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) return null;
    await this.prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    return row.userId;
  }

  async getAiPreference(userId: string) {
    return this.prisma.aiPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateAiPreference(userId: string, input: { provider?: string; model?: string; baseUrl?: string | null; enabled?: boolean }) {
    return this.prisma.aiPreference.upsert({ where: { userId }, create: { userId, ...input }, update: input });
  }

  async consumeAiQuota(userId: string, maxRequests: number) {
    const windowStarted = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    const row = await this.prisma.aiUsage.upsert({
      where: { userId_windowStarted: { userId, windowStarted } },
      create: { userId, windowStarted, requests: 1 },
      update: { requests: { increment: 1 } },
    });
    if (row.requests > maxRequests) {
      await this.prisma.aiUsage.update({ where: { id: row.id }, data: { requests: { decrement: 1 } } });
      throw new WorkspaceError('AI hourly quota reached. Try again later.', 429);
    }
    return { requests: row.requests, maxRequests, windowStarted: windowStarted.toISOString() };
  }

  async aiUsage(userId: string) {
    const windowStarted = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    const row = await this.prisma.aiUsage.findUnique({ where: { userId_windowStarted: { userId, windowStarted } } });
    return { requests: row?.requests ?? 0, inputTokens: row?.inputTokens ?? 0, outputTokens: row?.outputTokens ?? 0, windowStarted: windowStarted.toISOString() };
  }
}

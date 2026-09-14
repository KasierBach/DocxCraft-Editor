import { createHash, randomBytes } from 'node:crypto';

import type { PrismaClient } from './generated/prisma/client.ts';

export const SESSION_COOKIE_NAME = 'docxcraft_session';
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
};

export type ResolvedSession = {
  expiresAt: Date;
  user: SessionUser;
};

/** Sessions store only a hash of the token, so a leaked database cannot mint cookies. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Opaque, revocable sessions backed by the `sessions` table. Chosen over JWTs so
 * sign-out and "sign out everywhere" actually invalidate a session.
 */
export class SessionService {
  private readonly prisma: PrismaClient;

  private readonly ttlMs: number;

  constructor({
    prisma,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  }: {
    prisma: PrismaClient;
    ttlMs?: number;
  }) {
    this.prisma = prisma;
    this.ttlMs = ttlMs;
  }

  async createForUser(
    userId: string,
    context: { userAgent?: string | null; ip?: string | null } = {},
  ) {
    const token = createToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt,
        userAgent: context.userAgent ?? null,
        ip: context.ip ?? null,
      },
    });

    return { token, expiresAt };
  }

  async resolve(token: string | null | undefined): Promise<ResolvedSession | null> {
    if (!token) return null;

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });

    if (!session || session.expiresAt.getTime() <= Date.now() || session.user.deletedAt) {
      return null;
    }

    return {
      expiresAt: session.expiresAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        avatarUrl: session.user.avatarUrl,
        isAnonymous: session.user.isAnonymous,
      },
    };
  }

  async revoke(token: string | null | undefined) {
    if (!token) return;
    await this.prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}

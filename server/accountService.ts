import type { PrismaClient } from './generated/prisma/client.ts';

export type OAuthProfile = {
  provider: string;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
};

export type SignedInAccount = {
  userId: string;
  /** True when this sign-in created the account rather than matching an existing one. */
  created: boolean;
};

/**
 * Account lifecycle for the hosted product: anonymous guests, OAuth sign-in, and
 * merging a guest's documents into the account they sign in to.
 */
export class AccountService {
  private readonly prisma: PrismaClient;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  /** Creates the anonymous user behind an instant, no-signup workspace. */
  async createGuest() {
    const user = await this.prisma.user.create({ data: { isAnonymous: true } });
    return user.id;
  }

  /**
   * Resolves the user for an OAuth profile: reuse the linked account, else adopt
   * an existing non-anonymous user with the same email, else create a new user.
   */
  async findOrCreateUserFromProfile(profile: OAuthProfile): Promise<SignedInAccount> {
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (linked && !linked.user.deletedAt) {
      await this.refreshProfile(linked.userId, profile);
      return { userId: linked.userId, created: false };
    }

    // Emails are stored lower-cased so the lookup is case-insensitive.
    const email = profile.email?.trim().toLowerCase() ?? null;
    const existingUser = email
      ? await this.prisma.user.findFirst({
          where: { email, deletedAt: null, isAnonymous: false },
        })
      : null;

    return this.prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email,
            emailVerified: profile.emailVerified,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            isAnonymous: false,
          },
        }));

      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      });

      return { userId: user.id, created: !existingUser };
    });
  }

  /**
   * Moves a guest's documents to the signed-in account and removes the guest.
   * Documents are reassigned before the delete so the cascade removes nothing.
   * Returns the number of documents claimed.
   */
  async mergeGuestIntoUser(guestUserId: string, userId: string) {
    if (guestUserId === userId) return 0;

    const guest = await this.prisma.user.findUnique({ where: { id: guestUserId } });
    if (!guest?.isAnonymous) return 0;

    return this.prisma.$transaction(async (tx) => {
      const moved = await tx.document.updateMany({
        where: { ownerId: guestUserId },
        data: { ownerId: userId },
      });
      await tx.user.delete({ where: { id: guestUserId } });
      return moved.count;
    });
  }

  private async refreshProfile(userId: string, profile: OAuthProfile) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: profile.name ?? undefined,
        avatarUrl: profile.avatarUrl ?? undefined,
        emailVerified: profile.emailVerified || undefined,
      },
    });
  }

  /** Metadata-only export of the account and its documents (no blob contents). */
  async exportAccount(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const documents = await this.prisma.document.findMany({
      where: { ownerId: userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        sizeInBytes: true,
        versionCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAnonymous: user.isAnonymous,
        createdAt: user.createdAt.toISOString(),
      },
      documents: documents.map((document) => ({
        ...document,
        sizeInBytes: Number(document.sizeInBytes),
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      })),
    };
  }

  /** Deletes the account; documents, versions, sessions, and links cascade. */
  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipRole } from '@prisma/client';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'org'
  );
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new organization together with an initial OWNER membership and
   * a FREE-plan subscription record, all in a single transaction so a user
   * never ends up with an org but no ownership (or vice versa).
   */
  async createWithOwner(userId: string, name: string) {
    const baseSlug = slugify(name);

    return this.prisma.$transaction(async (tx) => {
      let slug = baseSlug;
      let suffix = 0;
      // Guarantee slug uniqueness without a retry-loop against the unique
      // constraint (cheap since org creation is a low-frequency operation).
      while (await tx.organization.findUnique({ where: { slug } })) {
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }

      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          memberships: {
            create: {
              userId,
              role: MembershipRole.OWNER,
            },
          },
          subscription: {
            create: {},
          },
        },
        include: { memberships: true, subscription: true },
      });

      return organization;
    });
  }

  findForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { memberships: { some: { userId } } },
      include: { subscription: true },
    });
  }

  async getMembership(userId: string, organizationId: string) {
    return this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
  }
}

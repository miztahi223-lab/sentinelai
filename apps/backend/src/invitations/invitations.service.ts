import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /** Invite management is restricted to OWNER/ADMIN — delegates to the
   * shared `OrganizationsService.assertManagerMembership` check (also used
   * by billing) so the two authorization boundaries can't quietly drift
   * apart from each other. */
  private assertCanManageInvitations(userId: string, organizationId: string) {
    return this.organizationsService.assertManagerMembership(
      userId,
      organizationId,
    );
  }

  async create(
    inviterUserId: string,
    organizationId: string,
    email: string,
    role: 'ADMIN' | 'MEMBER' = 'MEMBER',
  ) {
    await this.assertCanManageInvitations(inviterUserId, organizationId);
    const normalizedEmail = email.toLowerCase();

    const [inviter, organization, existingUser] = await Promise.all([
      this.usersService.findById(inviterUserId),
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.usersService.findByEmail(normalizedEmail),
    ]);
    if (!organization) throw new NotFoundException('Organization not found');

    // Don't allow inviting someone who's already a member — the caller
    // should look them up in the member list instead, not send a
    // redundant invite that would just fail confusingly on accept.
    if (existingUser) {
      const existingMembership = await this.organizationsService.getMembership(
        existingUser.id,
        organizationId,
      );
      if (existingMembership) {
        throw new ConflictException(
          'This person is already a member of the organization',
        );
      }
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    // Upsert on the (organizationId, email) unique constraint — re-inviting
    // someone (e.g. their first invite expired) replaces the old pending
    // invitation with a fresh token/expiry rather than erroring or leaving
    // two rows for the same person.
    const invitation = await this.prisma.invitation.upsert({
      where: {
        organizationId_email: { organizationId, email: normalizedEmail },
      },
      create: {
        organizationId,
        email: normalizedEmail,
        role: role,
        token,
        invitedByUserId: inviterUserId,
        expiresAt,
      },
      update: {
        role: role,
        token,
        invitedByUserId: inviterUserId,
        expiresAt,
        acceptedAt: null,
      },
    });

    await this.emailService.sendInvitationEmail(
      normalizedEmail,
      organization.name,
      inviter?.name ?? 'A teammate',
      token,
    );

    await this.auditLogsService.record({
      organizationId,
      userId: inviterUserId,
      action: 'invitation.created',
      metadata: { email: normalizedEmail, role },
    });

    return invitation;
  }

  async listPendingForOrganization(userId: string, organizationId: string) {
    await this.assertCanManageInvitations(userId, organizationId);
    return this.prisma.invitation.findMany({
      where: { organizationId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMembers(userId: string, organizationId: string) {
    const membership = await this.organizationsService.getMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }
    return this.prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async revoke(userId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    await this.assertCanManageInvitations(userId, invitation.organizationId);
    await this.prisma.invitation.delete({ where: { id: invitationId } });
    return { success: true };
  }

  /** Public lookup (no auth) so the accept page can show which organization
   * and role the invitation is for before the user signs in/registers. */
  async findByToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } },
    });
    if (!invitation || invitation.acceptedAt) {
      throw new NotFoundException(
        'This invitation is invalid or has already been used',
      );
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('This invitation has expired');
    }
    return invitation;
  }

  async accept(token: string, userId: string) {
    const invitation = await this.findByToken(token);
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // The invitation was sent to a specific email — only the person who
    // actually controls that mailbox (i.e. is logged in as that exact
    // account) can accept it. Without this check, anyone who guessed or
    // intercepted a token could join an organization as whatever role the
    // invitation carries, regardless of who it was actually meant for.
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address. Sign in with that account to accept it.',
      );
    }

    const existingMembership = await this.organizationsService.getMembership(
      userId,
      invitation.organizationId,
    );
    if (existingMembership) {
      throw new ConflictException(
        'You are already a member of this organization',
      );
    }

    const [membership] = await this.prisma.$transaction([
      this.prisma.membership.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    await this.auditLogsService.record({
      organizationId: invitation.organizationId,
      userId,
      action: 'invitation.accepted',
      metadata: { role: invitation.role },
    });

    return membership;
  }
}

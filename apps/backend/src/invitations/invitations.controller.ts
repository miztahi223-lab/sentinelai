import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Body() dto: CreateInvitationDto, @CurrentUser() user: RequestUser) {
    return this.invitationsService.create(
      user.userId,
      dto.organizationId,
      dto.email,
      dto.role,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  listPending(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invitationsService.listPendingForOrganization(
      user.userId,
      organizationId,
    );
  }

  // Must be registered before the generic `:token` route below, or Nest
  // would match a request for `/invitations/members` as `token=members`.
  @Get('members')
  @UseGuards(JwtAuthGuard)
  listMembers(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invitationsService.listMembers(user.userId, organizationId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  revoke(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.invitationsService.revoke(user.userId, id);
  }

  // Deliberately public (no JwtAuthGuard) — someone clicking an invite link
  // from their email hasn't necessarily signed in yet, and needs to see
  // which organization/role the invitation is for before deciding whether
  // to register or sign in to accept it.
  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  findByToken(@Param('token') token: string) {
    return this.invitationsService.findByToken(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  accept(@Param('token') token: string, @CurrentUser() user: RequestUser) {
    return this.invitationsService.accept(token, user.userId);
  }
}

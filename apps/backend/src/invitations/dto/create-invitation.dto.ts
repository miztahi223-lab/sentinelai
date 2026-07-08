import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateInvitationDto {
  @IsString()
  organizationId!: string;

  @IsEmail()
  email!: string;

  // Deliberately excludes OWNER — ownership isn't something you invite
  // someone into; it's set at organization-creation time (see
  // OrganizationsService.createWithOwner), and transferring it is a
  // separate, more sensitive operation this build doesn't implement yet.
  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'])
  role?: 'ADMIN' | 'MEMBER';
}

import { IsString, Matches, MaxLength } from 'class-validator';
import { HOSTNAME_REGEX } from '../../common/hostname.util';

export class CreateDomainDto {
  @IsString()
  organizationId!: string;

  @IsString()
  @MaxLength(253)
  @Matches(HOSTNAME_REGEX, {
    message: 'name must be a valid hostname (e.g. example.com)',
  })
  name!: string;
}

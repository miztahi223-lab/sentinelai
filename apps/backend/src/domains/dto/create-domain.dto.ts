import { IsString, Matches, MaxLength } from 'class-validator';

// Reasonably strict hostname validation: labels of alphanumerics/hyphens,
// dot-separated, no leading/trailing hyphen per label. Not a full RFC 1035
// validator, but enough to reject garbage/script-injection-shaped input at
// the API boundary before it ever reaches a scan job.
const HOSTNAME_REGEX =
  /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

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

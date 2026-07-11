import { IsString, Matches, MaxLength } from 'class-validator';
import { HOSTNAME_REGEX } from '../../common/hostname.util';

export class PublicScanDto {
  @IsString()
  @MaxLength(253)
  @Matches(HOSTNAME_REGEX, {
    message: 'domain must be a valid hostname (e.g. example.com)',
  })
  domain!: string;
}

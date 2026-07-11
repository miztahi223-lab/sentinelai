import { IsString, Length } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  challengeToken!: string;

  // 6 digits for a real TOTP code, or a 10-character hex backup code.
  @IsString()
  @Length(6, 10)
  code!: string;
}

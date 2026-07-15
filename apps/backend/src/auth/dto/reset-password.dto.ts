import { IsString } from 'class-validator';
import { StrongPassword } from '../../common/decorators/strong-password.decorator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @StrongPassword()
  newPassword!: string;
}

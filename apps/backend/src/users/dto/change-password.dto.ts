import { IsString } from 'class-validator';
import { StrongPassword } from '../../common/decorators/strong-password.decorator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @StrongPassword()
  newPassword!: string;
}

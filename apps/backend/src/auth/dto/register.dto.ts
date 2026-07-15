import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { StrongPassword } from '../../common/decorators/strong-password.decorator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @StrongPassword()
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  organizationName!: string;
}

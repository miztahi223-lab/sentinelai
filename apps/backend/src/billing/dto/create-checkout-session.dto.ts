import { IsIn, IsString } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  organizationId!: string;

  @IsIn(['STARTER', 'PROFESSIONAL', 'BUSINESS'])
  plan!: 'STARTER' | 'PROFESSIONAL' | 'BUSINESS';
}

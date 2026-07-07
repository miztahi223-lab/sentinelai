import { IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  scanId?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

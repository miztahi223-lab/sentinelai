import { IsString } from 'class-validator';

export class CreateScanDto {
  @IsString()
  domainId!: string;
}

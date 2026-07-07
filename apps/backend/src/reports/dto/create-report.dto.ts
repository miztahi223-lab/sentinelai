import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  scanId?: string;

  // Used both inside the generated PDF and as the download filename
  // (`res.download(..., \`${title}.pdf\`)`) — bounded so it can't be used
  // for a storage/rendering-cost DoS, consistent with every other
  // free-text field in this API (e.g. RegisterDto's name/organizationName,
  // ContactMessageDto's subject/message) all being length-bounded. Express's
  // `content-disposition` dependency already safely encodes the header
  // value regardless, so this is defense-in-depth, not a fix for an
  // existing header-injection bug.
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;
}

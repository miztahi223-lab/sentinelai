import { IsBoolean, IsOptional, IsUrl } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  webhookUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  slackWebhookUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  dailyDigestEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyDigestEnabled?: boolean;
}

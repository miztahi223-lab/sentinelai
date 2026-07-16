import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Persists the message *before* attempting to email anyone about it —
   * a real failure mode this closes, not a hypothetical one: an SMTP
   * outage/misconfiguration (observed for real: a fresh Microsoft 365
   * tenant blocking SMTP AUTH by default) used to mean the visitor's
   * message was gone the moment `sendContactMessage` threw, with a bare
   * 500 as the only trace. The database write is the actual durable
   * record; the email is now a best-effort notification on top of it, not
   * the only copy that exists.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async submit(@Body() dto: CreateContactMessageDto) {
    const saved = await this.prisma.contactMessage.create({ data: dto });

    try {
      await this.emailService.sendContactMessage(dto);
      await this.prisma.contactMessage.update({
        where: { id: saved.id },
        data: { emailSentAt: new Date() },
      });
    } catch (error) {
      // The message is already safely stored — a notification-email
      // failure is logged for follow-up, not surfaced to the visitor as a
      // failed submission (it wasn't one).
      this.logger.error(
        `Contact message ${saved.id} saved, but the notification email failed: ${(error as Error).message}`,
      );
    }

    return { success: true };
  }
}

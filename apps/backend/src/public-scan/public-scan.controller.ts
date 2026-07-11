import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicScanService } from './public-scan.service';
import { PublicScanDto } from './dto/public-scan.dto';

@Controller('public-scan')
export class PublicScanController {
  constructor(private readonly publicScanService: PublicScanService) {}

  /**
   * No `JwtAuthGuard` — this is the anonymous "try a free scan" widget on
   * the landing page, the entire point of which is that a visitor hasn't
   * signed up yet. That makes it the one endpoint in this API that lets an
   * anonymous caller trigger real outbound network probes against a
   * hostname of their choosing, so it gets a much tighter per-IP rate limit
   * than the global default (100/min) — closer to `contact`'s 5/min than
   * anything authenticated, since there's no per-user/per-org quota to fall
   * back on here.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async scan(@Body() dto: PublicScanDto) {
    return this.publicScanService.scan(dto.domain);
  }
}

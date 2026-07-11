import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A real, unauthenticated health check — genuinely queries the real
 * database rather than always returning a hardcoded "ok". Backs the public
 * `/status` page: that page can only ever honestly show what this endpoint
 * actually reports right now, not a fabricated historical uptime record
 * this build environment has no real monitoring data to produce.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const checkedAt = new Date().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok' as const,
        database: 'ok' as const,
        checkedAt,
      };
    } catch {
      return {
        status: 'degraded' as const,
        database: 'error' as const,
        checkedAt,
      };
    }
  }
}

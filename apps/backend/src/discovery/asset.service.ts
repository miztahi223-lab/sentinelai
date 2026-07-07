import { Injectable } from '@nestjs/common';
import { AssetType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records that an asset was observed for a domain. If it already exists
   * (same domainId+type+value), bumps `lastSeenAt` and merges metadata
   * rather than creating a duplicate row — assets are meant to persist
   * across scans so change-detection (Step 9) can later diff
   * firstSeenAt/lastSeenAt/metadata between runs.
   */
  async upsertObservedAsset(params: {
    domainId: string;
    type: AssetType;
    value: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const { domainId, type, value, metadata } = params;
    const now = new Date();

    return this.prisma.asset.upsert({
      where: { domainId_type_value: { domainId, type, value } },
      create: {
        domainId,
        type,
        value,
        metadata: metadata ?? Prisma.JsonNull,
        firstSeenAt: now,
        lastSeenAt: now,
        active: true,
      },
      update: {
        lastSeenAt: now,
        metadata: metadata ?? Prisma.JsonNull,
        active: true,
      },
    });
  }

  /**
   * Marks assets that were NOT observed in the current discovery run as
   * inactive (still kept for history, per Step 9's "removed asset"
   * detection use case — a disappearing asset is itself a signal, not
   * something to silently delete).
   */
  async markStaleAssetsInactive(
    domainId: string,
    observedIds: string[],
  ): Promise<number> {
    const result = await this.prisma.asset.updateMany({
      where: {
        domainId,
        active: true,
        id: { notIn: observedIds.length > 0 ? observedIds : ['__none__'] },
      },
      data: { active: false },
    });
    return result.count;
  }

  findAllForDomain(domainId: string) {
    return this.prisma.asset.findMany({
      where: { domainId },
      orderBy: [{ active: 'desc' }, { lastSeenAt: 'desc' }],
    });
  }
}

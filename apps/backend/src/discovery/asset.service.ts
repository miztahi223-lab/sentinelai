import { Injectable } from '@nestjs/common';
import { Asset, AssetType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertResult {
  asset: Asset;
  isNew: boolean;
}

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records that an asset was observed for a domain. If it already exists
   * (same domainId+type+value), bumps `lastSeenAt` and merges metadata
   * rather than creating a duplicate row — assets are meant to persist
   * across scans so change-detection can diff firstSeenAt/lastSeenAt/
   * metadata between runs. Returns whether the asset was newly created (as
   * opposed to a pre-existing one just being re-observed) so callers (the
   * scan worker) can raise "new asset discovered" alerts precisely rather
   * than guessing from timestamps after the fact.
   */
  async upsertObservedAsset(params: {
    domainId: string;
    type: AssetType;
    value: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<UpsertResult> {
    const { domainId, type, value, metadata } = params;
    const now = new Date();

    const existing = await this.prisma.asset.findUnique({
      where: { domainId_type_value: { domainId, type, value } },
    });

    if (existing) {
      const asset = await this.prisma.asset.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: now,
          metadata: metadata ?? Prisma.JsonNull,
          active: true,
        },
      });
      return { asset, isNew: false };
    }

    const asset = await this.prisma.asset.create({
      data: {
        domainId,
        type,
        value,
        metadata: metadata ?? Prisma.JsonNull,
        firstSeenAt: now,
        lastSeenAt: now,
        active: true,
      },
    });
    return { asset, isNew: true };
  }

  /**
   * Marks assets that were NOT observed in the current discovery run as
   * inactive (still kept for history — a disappearing asset is itself a
   * signal, not something to silently delete) and returns the assets that
   * were actually just deactivated, so callers can raise "asset removed"
   * alerts with real detail (type/value) rather than just a count.
   */
  async markStaleAssetsInactive(
    domainId: string,
    observedIds: string[],
  ): Promise<Asset[]> {
    const staleAssets = await this.prisma.asset.findMany({
      where: {
        domainId,
        active: true,
        id: { notIn: observedIds.length > 0 ? observedIds : ['__none__'] },
      },
    });

    if (staleAssets.length > 0) {
      await this.prisma.asset.updateMany({
        where: { id: { in: staleAssets.map((a) => a.id) } },
        data: { active: false },
      });
    }

    return staleAssets;
  }

  findAllForDomain(domainId: string) {
    return this.prisma.asset.findMany({
      where: { domainId },
      orderBy: [{ active: 'desc' }, { lastSeenAt: 'desc' }],
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SpotsService } from '../spots/spots.service';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spotsService: SpotsService,
  ) {}

  async list(userId: string, page = 1, pageSize = 50) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));
    const where = { userId, spot: { active: true } };
    const [total, rows] = await Promise.all([
      this.prisma.mapFavorite.count({ where }),
      this.prisma.mapFavorite.findMany({
        where,
        include: {
          spot: {
            include: {
              boatLinks: {
                select: { boat: { select: { boatId: true } } },
              },
            },
          },
        },
        orderBy: { spotId: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);
    return {
      total,
      page: safePage,
      pageSize: safePageSize,
      items: rows.map((row) => this.spotsService.formatSpotSummary(row.spot)),
    };
  }

  async listSpotKeys(userId: string) {
    const rows = await this.prisma.mapFavorite.findMany({
      where: { userId, spot: { active: true } },
      select: { spot: { select: { spotKey: true } } },
      orderBy: { spotId: 'desc' },
    });
    return rows.map((row) => row.spot.spotKey);
  }

  async add(userId: string, spotKey: string) {
    const spot = await this.prisma.fishingSpot.findFirst({
      where: { spotKey, active: true },
    });
    if (!spot) {
      throw new NotFoundException('钓点不存在');
    }

    await this.prisma.mapFavorite.upsert({
      where: {
        userId_spotId: { userId, spotId: spot.id },
      },
      update: {},
      create: { userId, spotId: spot.id },
    });

    return { favorited: true, spotKey };
  }

  async remove(userId: string, spotKey: string) {
    const spot = await this.prisma.fishingSpot.findFirst({
      where: { spotKey },
    });
    if (!spot) {
      return { favorited: false, spotKey };
    }

    await this.prisma.mapFavorite.deleteMany({
      where: { userId, spotId: spot.id },
    });

    return { favorited: false, spotKey };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type BannerItem = { url: string; title: string; subtitle: string };

@Injectable()
export class BannersService {
  private cache: BannerItem[] | null = null;
  private cacheTs = 0;
  private readonly ttlMs = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  invalidateCache() {
    this.cache = null;
    this.cacheTs = 0;
  }

  async list() {
    const now = Date.now();
    if (this.cache && now - this.cacheTs < this.ttlMs) {
      return this.cache;
    }
    const rows = await this.prisma.banner.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      take: 10,
      select: {
        imageUrl: true,
        title: true,
        subtitle: true,
      },
    });
    this.cache = rows.map((item) => ({
      url: item.imageUrl,
      title: item.title,
      subtitle: item.subtitle,
    }));
    this.cacheTs = now;
    return this.cache;
  }
}

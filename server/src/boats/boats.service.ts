import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoatReviewDto } from './dto/create-boat-review.dto';
import { ListBoatsDto } from './dto/list-boats.dto';

const LIST_BOAT_SELECT = {
  id: true,
  boatId: true,
  shipName: true,
  maxNum: true,
  shipLen: true,
  shipWid: true,
  score: true,
  sailCount: true,
  experience: true,
  captain: true,
  captainAvatar: true,
  price: true,
  wharf: true,
  displayWharf: true,
  facilities: true,
  images: true,
} as const;

@Injectable()
export class BoatsService {
  private boatIdCache = new Map<string, { id: string; ts: number }>();
  private readonly boatIdCacheTtlMs = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListBoatsDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const where: Prisma.BoatWhereInput = { active: true };

    if (query.wharf && query.wharf !== '全部码头') {
      where.wharf = query.wharf;
    }

    if (query.boatIds) {
      const ids = query.boatIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length) {
        where.boatId = { in: ids };
      }
    }

    if (query.keyword) {
      where.OR = [
        { shipName: { contains: query.keyword } },
        { captain: { contains: query.keyword } },
        { boatId: { contains: query.keyword } },
      ];
    }

    if (query.minScore != null) {
      where.score = { gte: Number(query.minScore) };
    }
    if (query.minLength != null) {
      where.shipLen = { gte: Number(query.minLength) };
    }
    if (query.minExperience != null) {
      where.experience = { gte: Number(query.minExperience) };
    }
    if (query.people != null && query.people > 0) {
      where.maxNum = { gte: Number(query.people) };
    }

    let orderBy: Prisma.BoatOrderByWithRelationInput[] = [
      { score: 'desc' },
      { price: 'asc' },
    ];
    if (query.sort === 'priceAsc') {
      orderBy = [{ price: 'asc' }];
    } else if (query.sort === 'priceDesc') {
      orderBy = [{ price: 'desc' }];
    }

    const facilityFilter = (query.facilities || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    if (facilityFilter.length) {
      return this.listWithFacilityFilter(
        query,
        facilityFilter,
        orderBy,
        page,
        pageSize,
      );
    }

    const [total, items] = await Promise.all([
      this.prisma.boat.count({ where }),
      this.prisma.boat.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: LIST_BOAT_SELECT,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: items.map((boat) => this.toListShip(boat)),
    };
  }

  private parseFacilities(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item));
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  async detail(boatId: string) {
    const boat = await this.findBoatRecord(boatId);
    return this.toMiniShip(boat);
  }

  async listReviews(boatId: string) {
    const boat = await this.findBoatRecord(boatId);
    const rows = await this.prisma.boatReview.findMany({
      where: { boatId: boat.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      user: row.nickName || '钓友',
      score: row.score,
      content: row.content,
      createdAt: row.createdAt.getTime(),
    }));
  }

  async createReview(boatId: string, userId: string, dto: CreateBoatReviewDto) {
    const boat = await this.findBoatRecord(boatId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const nickName = user?.realName || user?.nickName || '钓友';
    const review = await this.prisma.boatReview.create({
      data: {
        boatId: boat.id,
        userId,
        nickName,
        score: dto.score,
        content: dto.content,
      },
    });
    return {
      id: review.id,
      user: review.nickName || '钓友',
      score: review.score,
      content: review.content,
      createdAt: review.createdAt.getTime(),
    };
  }

  async listMyFavorites(userId: string, page = 1, pageSize = 50) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));
    const where = { userId, boat: { active: true } };
    const [total, rows] = await Promise.all([
      this.prisma.boatFavorite.count({ where }),
      this.prisma.boatFavorite.findMany({
        where,
        include: { boat: { select: LIST_BOAT_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);
    return {
      total,
      page: safePage,
      pageSize: safePageSize,
      items: rows.map(({ boat }) => this.toFavoriteShip(boat)),
    };
  }

  invalidateBoatCache(boatKey?: string) {
    if (boatKey) {
      this.boatIdCache.delete(boatKey);
      return;
    }
    this.boatIdCache.clear();
  }

  async isFavorite(userId: string, boatId: string) {
    const recordId = await this.resolveBoatId(boatId);
    const row = await this.prisma.boatFavorite.findUnique({
      where: { userId_boatId: { userId, boatId: recordId } },
    });
    return { favorited: !!row };
  }

  async addFavorite(userId: string, boatId: string) {
    const recordId = await this.resolveBoatId(boatId);
    await this.prisma.boatFavorite.upsert({
      where: { userId_boatId: { userId, boatId: recordId } },
      update: {},
      create: { userId, boatId: recordId },
    });
    return { favorited: true };
  }

  async removeFavorite(userId: string, boatId: string) {
    const recordId = await this.resolveBoatId(boatId);
    await this.prisma.boatFavorite.deleteMany({
      where: { userId, boatId: recordId },
    });
    return { favorited: false };
  }

  private async resolveBoatId(boatId: string) {
    const cached = this.boatIdCache.get(boatId);
    if (cached && Date.now() - cached.ts < this.boatIdCacheTtlMs) {
      return cached.id;
    }
    const boat = await this.prisma.boat.findFirst({
      where: {
        OR: [{ boatId, active: true }, { id: boatId, active: true }],
      },
      select: { id: true, boatId: true },
    });
    if (!boat) {
      throw new NotFoundException('船只不存在');
    }
    this.boatIdCache.set(boatId, { id: boat.id, ts: Date.now() });
    this.boatIdCache.set(boat.boatId, { id: boat.id, ts: Date.now() });
    return boat.id;
  }

  private buildBoatSqlFilters(query: ListBoatsDto): Prisma.Sql[] {
    const parts: Prisma.Sql[] = [Prisma.sql`active = 1`];
    if (query.wharf && query.wharf !== '全部码头') {
      parts.push(Prisma.sql`wharf = ${query.wharf}`);
    }
    if (query.boatIds) {
      const ids = query.boatIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length) {
        parts.push(Prisma.sql`boat_id IN (${Prisma.join(ids)})`);
      }
    }
    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      parts.push(
        Prisma.sql`(ship_name LIKE ${kw} OR captain LIKE ${kw} OR boat_id LIKE ${kw})`,
      );
    }
    if (query.minScore != null) {
      parts.push(Prisma.sql`score >= ${Number(query.minScore)}`);
    }
    if (query.minLength != null) {
      parts.push(Prisma.sql`ship_len >= ${Number(query.minLength)}`);
    }
    if (query.minExperience != null) {
      parts.push(Prisma.sql`experience >= ${Number(query.minExperience)}`);
    }
    if (query.people != null && query.people > 0) {
      parts.push(Prisma.sql`max_num >= ${Number(query.people)}`);
    }
    return parts;
  }

  private buildBoatOrderSql(query: ListBoatsDto) {
    if (query.sort === 'priceAsc') {
      return Prisma.sql`ORDER BY price ASC`;
    }
    if (query.sort === 'priceDesc') {
      return Prisma.sql`ORDER BY price DESC`;
    }
    return Prisma.sql`ORDER BY score DESC, price ASC`;
  }

  private async listWithFacilityFilter(
    query: ListBoatsDto,
    facilityFilter: string[],
    orderBy: Prisma.BoatOrderByWithRelationInput[],
    page: number,
    pageSize: number,
  ) {
    void orderBy;
    const facilitySql = Prisma.join(
      facilityFilter.map(
        (name) =>
          Prisma.sql`JSON_CONTAINS(facilities, ${JSON.stringify(name)}, '$')`,
      ),
      ' AND ',
    );
    const whereSql = Prisma.join(
      [...this.buildBoatSqlFilters(query), facilitySql],
      ' AND ',
    );
    const offset = (page - 1) * pageSize;
    const orderSql = this.buildBoatOrderSql(query);

    const [pageRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM boats
        WHERE ${whereSql}
        ${orderSql}
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<[{ cnt: bigint }]>`
        SELECT COUNT(*) as cnt FROM boats WHERE ${whereSql}
      `,
    ]);

    const pageIds = pageRows.map((row) => row.id);
    const items =
      pageIds.length > 0
        ? await this.prisma.boat.findMany({
            where: { id: { in: pageIds } },
            orderBy: [
              { score: 'desc' },
              { price: 'asc' },
            ],
            select: LIST_BOAT_SELECT,
          })
        : [];
    const idOrder = new Map(pageIds.map((id, index) => [id, index]));
    items.sort(
      (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
    );

    return {
      total: Number(countRows[0]?.cnt ?? 0),
      page,
      pageSize,
      items: items.map((boat) => this.toListShip(boat)),
    };
  }

  private async findBoatRecord(boatId: string) {
    const cached = this.boatIdCache.get(boatId);
    if (cached && Date.now() - cached.ts < this.boatIdCacheTtlMs) {
      const boat = await this.prisma.boat.findFirst({
        where: { id: cached.id, active: true },
      });
      if (boat) return boat;
      this.boatIdCache.delete(boatId);
    }

    let boat = await this.prisma.boat.findFirst({
      where: { boatId, active: true },
    });
    if (!boat) {
      boat = await this.prisma.boat.findFirst({
        where: { id: boatId, active: true },
      });
    }
    if (!boat) {
      throw new NotFoundException('船只不存在');
    }
    this.boatIdCache.set(boatId, { id: boat.id, ts: Date.now() });
    this.boatIdCache.set(boat.boatId, { id: boat.id, ts: Date.now() });
    return boat;
  }

  private toListShip(boat: {
    id: string;
    boatId: string;
    shipName: string;
    maxNum: number;
    shipLen: number | null;
    shipWid: number | null;
    score: number;
    sailCount: number;
    experience: number;
    captain: string;
    captainAvatar: string;
    price: number;
    wharf: string;
    displayWharf: string;
    facilities: unknown;
    images: unknown;
  }) {
    const images = Array.isArray(boat.images) ? (boat.images as string[]) : [];
    const coverImage = images[0] || '/images/boat1.jpg';
    const facilities = Array.isArray(boat.facilities)
      ? (boat.facilities as string[])
      : [];

    return {
      id: boat.id,
      shipName: boat.shipName,
      boatId: boat.boatId,
      maxNum: boat.maxNum,
      shipLen: boat.shipLen,
      shipWid: boat.shipWid,
      score: boat.score,
      sailCount: boat.sailCount,
      experience: boat.experience,
      captain: boat.captain,
      captainAvatar: boat.captainAvatar,
      price: boat.price,
      images: [coverImage],
      coverImage,
      wharf: boat.wharf,
      displayWharf: boat.displayWharf,
      departWharf: boat.displayWharf || boat.wharf,
      facilities,
    };
  }

  private toFavoriteShip(boat: {
    boatId: string;
    shipName: string;
    captain: string;
    captainAvatar: string;
    price: number;
    wharf: string;
    displayWharf: string;
    score: number;
    images: unknown;
  }) {
    const images = Array.isArray(boat.images) ? (boat.images as string[]) : [];
    const coverImage = images[0] || '/images/boat1.jpg';
    return {
      boatId: boat.boatId,
      shipName: boat.shipName,
      captain: boat.captain,
      price: boat.price,
      wharf: boat.wharf,
      displayWharf: boat.displayWharf,
      score: boat.score,
      coverImage,
    };
  }

  private toMiniShip(boat: {
    id: string;
    boatId: string;
    shipName: string;
    maxNum: number;
    shipLen: number | null;
    shipWid: number | null;
    score: number;
    sailCount: number;
    experience: number;
    captain: string;
    captainAvatar: string;
    price: number;
    wharf: string;
    displayWharf: string;
    facilities: unknown;
    images: unknown;
    description: string;
    contact: string;
    builtYear: number | null;
  }) {
    const images = Array.isArray(boat.images) ? (boat.images as string[]) : [];
    const facilities = Array.isArray(boat.facilities)
      ? (boat.facilities as string[])
      : [];

    return {
      id: boat.id,
      shipName: boat.shipName,
      boatId: boat.boatId,
      maxNum: boat.maxNum,
      shipLen: boat.shipLen,
      shipWid: boat.shipWid,
      score: boat.score,
      sailCount: boat.sailCount,
      experience: boat.experience,
      captain: boat.captain,
      captainName: boat.captain,
      captainAvatar: boat.captainAvatar,
      price: boat.price,
      images: images.length ? images : ['/images/boat1.jpg'],
      coverImage: images[0] || '/images/boat1.jpg',
      wharf: boat.wharf,
      displayWharf: boat.displayWharf,
      departWharf: boat.displayWharf || boat.wharf,
      facilities,
      description: boat.description,
      contact: boat.contact,
      builtYear: boat.builtYear,
    };
  }
}

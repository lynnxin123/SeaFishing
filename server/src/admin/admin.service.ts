import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BookingStatus } from '@prisma/client';
import { BoatsService } from '../boats/boats.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpotsService } from '../spots/spots.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpsertBoatDto } from './dto/upsert-boat.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly boatsService: BoatsService,
    private readonly spotsService: SpotsService,
  ) {}

  login(dto: AdminLoginDto) {
    const username = this.config.get<string>('ADMIN_USERNAME') || 'admin';
    const password = this.config.get<string>('ADMIN_PASSWORD') || 'admin123';

    if (dto.username !== username || dto.password !== password) {
      throw new UnauthorizedException('管理员账号或密码错误');
    }

    const token = this.jwtService.sign({
      sub: dto.username,
      role: 'admin',
    });

    return { token, username: dto.username };
  }

  async listBookings(status?: string, page = 1, pageSize = 50) {
    const where =
      status && status !== 'all'
        ? { status: status as BookingStatus }
        : undefined;
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));

    const [total, items] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          user: {
            select: { nickName: true, phone: true, realName: true },
          },
        },
      }),
    ]);

    return { total, page: safePage, pageSize: safePageSize, items };
  }

  async updateBookingStatus(id: string, status: BookingStatus) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      throw new NotFoundException('订单不存在');
    }
    return this.prisma.booking.update({
      where: { id },
      data: { status },
    });
  }

  listBoats(page = 1, pageSize = 50) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    return Promise.all([
      this.prisma.boat.count(),
      this.prisma.boat.findMany({
        orderBy: { updatedAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        select: {
          id: true,
          boatId: true,
          shipName: true,
          maxNum: true,
          price: true,
          wharf: true,
          captain: true,
          score: true,
          active: true,
          updatedAt: true,
        },
      }),
    ]).then(([total, items]) => ({
      total,
      page: safePage,
      pageSize: safePageSize,
      items,
    }));
  }

  async createBoat(dto: UpsertBoatDto) {
    const boat = await this.prisma.boat.create({
      data: {
        boatId: dto.boatId,
        shipName: dto.shipName,
        maxNum: dto.maxNum ?? 8,
        price: dto.price ?? 0,
        wharf: dto.wharf ?? '大连码头',
        displayWharf: dto.wharf ?? '大连码头',
        captain: dto.captain ?? '',
        score: dto.score ?? 4.5,
        images: dto.images ?? [],
        facilities: dto.facilities ?? [],
      },
    });
    this.boatsService.invalidateBoatCache();
    return boat;
  }

  async updateBoat(boatId: string, dto: UpsertBoatDto) {
    const boat = await this.prisma.boat.findFirst({
      where: { OR: [{ boatId }, { id: boatId }] },
    });
    if (!boat) {
      throw new NotFoundException('船只不存在');
    }

    const updated = await this.prisma.boat.update({
      where: { id: boat.id },
      data: {
        shipName: dto.shipName,
        maxNum: dto.maxNum,
        price: dto.price,
        wharf: dto.wharf,
        displayWharf: dto.wharf,
        captain: dto.captain,
        score: dto.score,
        images: dto.images,
        facilities: dto.facilities,
        active: dto.active,
      },
    });
    this.boatsService.invalidateBoatCache(boat.boatId);
    this.boatsService.invalidateBoatCache(boat.id);
    this.spotsService.invalidateListCache();
    return updated;
  }

  listCompetitions() {
    return this.prisma.competition.findMany({
      orderBy: { legacyId: 'asc' },
      select: {
        id: true,
        legacyId: true,
        name: true,
        status: true,
        statusText: true,
        location: true,
        time: true,
        active: true,
        _count: { select: { registrations: true } },
      },
    });
  }

  async listRegistrations(legacyId: number, page = 1, pageSize = 50) {
    const competition = await this.prisma.competition.findFirst({
      where: { legacyId },
    });
    if (!competition) {
      throw new NotFoundException('赛事不存在');
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const where = { competitionId: competition.id };

    const [total, items] = await Promise.all([
      this.prisma.competitionRegistration.count({ where }),
      this.prisma.competitionRegistration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          user: {
            select: { nickName: true, phone: true },
          },
        },
      }),
    ]);

    return { total, page: safePage, pageSize: safePageSize, items };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BookingStatus } from '@prisma/client';
import { PAID_BOOKING_STATUSES } from '../bookings/booking-rules.config';
import { BookingRulesService } from '../bookings/booking-rules.service';
import { BoatsService } from '../boats/boats.service';
import { MessagesService } from '../messages/messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { SpotsService } from '../spots/spots.service';
import {
  addDays,
  enrichBoatOperational,
  formatYmd,
} from './boat-operational.helper';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpsertBoatDto } from './dto/upsert-boat.dto';

const ADMIN_STATUS_FLOW: Partial<
  Record<BookingStatus, readonly BookingStatus[]>
> = {
  pending_pay: ['cancelled'],
  pending_accept: ['accepted', 'cancelled'],
  accepted: ['departed', 'cancelled'],
  departed: ['completed', 'no_show', 'cancelled'],
};

const ADMIN_CANCELLABLE: BookingStatus[] = [
  'pending_pay',
  'pending_accept',
  'accepted',
  'departed',
];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly boatsService: BoatsService,
    private readonly spotsService: SpotsService,
    private readonly messagesService: MessagesService,
    private readonly bookingRules: BookingRulesService,
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

  /** 实付汇总：待接单及之后状态视为已付款（兼容历史数据未写 paidAt） */
  private buildPaidAmountWhere(where?: { status: BookingStatus }) {
    if (!where?.status) {
      return { status: { in: [...PAID_BOOKING_STATUSES] } };
    }
    if (
      !(PAID_BOOKING_STATUSES as readonly BookingStatus[]).includes(
        where.status,
      )
    ) {
      return { id: { in: [] as string[] } };
    }
    return where;
  }

  async listBookings(status?: string, page = 1, pageSize = 50) {
    const where =
      status && status !== 'all'
        ? { status: status as BookingStatus }
        : undefined;
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));

    const paidWhere = this.buildPaidAmountWhere(where);

    const [total, items, agg, paidAgg] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          user: {
            select: {
              nickName: true,
              phone: true,
              wechatId: true,
              realName: true,
              verified: true,
            },
          },
        },
      }),
      this.prisma.booking.aggregate({
        where,
        _sum: { totalAmount: true, people: true },
      }),
      this.prisma.booking.aggregate({
        where: paidWhere,
        _sum: { totalAmount: true },
      }),
    ]);

    const amountSum = Number(agg._sum.totalAmount || 0);
    const paidAmountSum = Number(paidAgg._sum.totalAmount || 0);

    return {
      total,
      page: safePage,
      pageSize: safePageSize,
      items,
      amountSum,
      paidAmountSum,
      unpaidAmountSum: Math.max(0, amountSum - paidAmountSum),
      peopleSum: agg._sum.people || 0,
    };
  }

  async updateBookingStatus(id: string, status: BookingStatus) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      throw new NotFoundException('订单不存在');
    }
    if (booking.status === status) {
      return booking;
    }

    if (status === 'no_show') {
      if (booking.status !== 'departed' && booking.status !== 'accepted') {
        throw new BadRequestException('仅已接单或已出港订单可标记爽约');
      }
      await this.bookingRules.markNoShow(booking.userId, id);
      const updated = await this.prisma.booking.findUnique({ where: { id } });
      if (!updated) {
        throw new NotFoundException('订单不存在');
      }
      return updated;
    }

    if (status === 'cancelled') {
      if (!ADMIN_CANCELLABLE.includes(booking.status)) {
        throw new BadRequestException('当前状态不可取消');
      }
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.bookingRules.releaseInventory(tx, booking);
        return tx.booking.update({
          where: { id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelReason: '管理端取消',
            cancelType: 'admin',
            refundPercent: 0,
            refundAmount: 0,
          },
        });
      });
      return updated;
    }

    if (status === 'accepted' && booking.status === 'pending_pay') {
      throw new BadRequestException(
        '待付款订单须用户完成付款后才能接单',
      );
    }

    const allowed = ADMIN_STATUS_FLOW[booking.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `不可从「${booking.status}」变更为「${status}」`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status },
    });
    if (status === 'accepted' && booking.status !== 'accepted') {
      await this.messagesService.notifyBookingAccepted(updated);
    }
    return updated;
  }

  async listBoats(page = 1, pageSize = 50) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const today = formatYmd(new Date());
    const monthEnd = formatYmd(addDays(new Date(), 30));

    const [total, items] = await Promise.all([
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
    ]);

    const boatIds = items.map((b) => b.id);
    const bookings =
      boatIds.length === 0
        ? []
        : await this.prisma.booking.findMany({
            where: {
              boatId: { in: boatIds },
              OR: [
                {
                  date: { gte: today, lte: monthEnd },
                  status: {
                    in: [
                      'pending_accept',
                      'accepted',
                      'departed',
                      'completed',
                    ],
                  },
                },
                { status: 'departed' },
              ],
            },
            select: {
              boatId: true,
              date: true,
              slotTime: true,
              people: true,
              status: true,
              orderNo: true,
            },
          });

    const enriched = items.map((boat) => ({
      ...boat,
      ...enrichBoatOperational(boat, bookings, today, monthEnd),
    }));

    return {
      total,
      page: safePage,
      pageSize: safePageSize,
      items: enriched,
      scheduleRange: { from: today, to: monthEnd },
    };
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
        fee: true,
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

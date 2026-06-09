import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../users/rewards.service';
import { CreateBookingDto } from './dto/create-booking.dto';

const BOOKING_SELECT = {
  id: true,
  orderNo: true,
  shipName: true,
  boatId: true,
  coverImage: true,
  price: true,
  wharf: true,
  departWharf: true,
  date: true,
  people: true,
  captainName: true,
  status: true,
  createdAt: true,
} as const;

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_pay: '待付款',
  pending_accept: '待接单',
  accepted: '已接单',
  departed: '已出港',
  completed: '已完成',
  cancelled: '已取消',
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
  ) {}

  async list(
    userId: string,
    status?: string,
    page = 1,
    pageSize = 20,
  ) {
    const where: { userId: string; status?: BookingStatus } = { userId };
    if (status && status !== 'all' && status in STATUS_LABEL) {
      where.status = status as BookingStatus;
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));

    const [total, orders] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        select: BOOKING_SELECT,
      }),
    ]);

    return {
      total,
      page: safePage,
      pageSize: safePageSize,
      items: orders.map((order) => this.toMiniOrder(order)),
    };
  }

  async create(userId: string, dto: CreateBookingDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      let boatRecordId: string | undefined;
      if (dto.boatId) {
        const boat = await tx.boat.findFirst({
          where: {
            OR: [{ boatId: dto.boatId }, { id: dto.boatId }],
          },
          select: { id: true },
        });
        boatRecordId = boat?.id;
      }

      const created = await tx.booking.create({
        data: {
          orderNo: this.genOrderNo(),
          userId,
          boatId: boatRecordId,
          shipName: dto.shipName,
          coverImage: dto.coverImage || '/images/boat1.jpg',
          price: dto.price != null ? String(dto.price) : '',
          wharf: dto.wharf || dto.departWharf || '',
          departWharf: dto.departWharf || dto.wharf || '',
          date: dto.date,
          people: dto.people,
          captainName: dto.captainName || '',
          status: (dto.status as BookingStatus) || BookingStatus.pending_accept,
        },
        select: BOOKING_SELECT,
      });

      await this.rewardsService.grantInTransaction(tx, userId, {
        type: 'booking_create',
        points: 10,
        fishFood: 1,
        remark: `预约船只：${dto.shipName}`,
      });

      return created;
    });

    return this.toMiniOrder(order);
  }

  async syncBatch(userId: string, items: CreateBookingDto[]) {
    const batch = (items || []).slice(0, 30);
    if (!batch.length) {
      return { synced: 0 };
    }

    const boatKeys = [
      ...new Set(
        batch.map((item) => item.boatId).filter((id): id is string => !!id),
      ),
    ];
    const boatRows = boatKeys.length
      ? await this.prisma.boat.findMany({
          where: {
            OR: [{ boatId: { in: boatKeys } }, { id: { in: boatKeys } }],
          },
          select: { id: true, boatId: true },
        })
      : [];
    const boatMap = new Map<string, string>();
    boatRows.forEach((boat) => {
      boatMap.set(boat.boatId, boat.id);
      boatMap.set(boat.id, boat.id);
    });

    const ordersData = batch.map((dto) => ({
      orderNo: this.genOrderNo(),
      userId,
      boatId: dto.boatId ? boatMap.get(dto.boatId) : undefined,
      shipName: dto.shipName,
      coverImage: dto.coverImage || '/images/boat1.jpg',
      price: dto.price != null ? String(dto.price) : '',
      wharf: dto.wharf || dto.departWharf || '',
      departWharf: dto.departWharf || dto.wharf || '',
      date: dto.date,
      people: dto.people,
      captainName: dto.captainName || '',
      status: (dto.status as BookingStatus) || BookingStatus.pending_accept,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.createMany({ data: ordersData });
      await this.rewardsService.grantInTransaction(tx, userId, {
        type: 'booking_create',
        points: ordersData.length * 10,
        fishFood: ordersData.length,
        remark: `批量同步预约 ${ordersData.length} 条`,
      });
    });

    return { synced: ordersData.length };
  }

  async cancel(userId: string, orderId: string) {
    const order = await this.prisma.booking.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (
      order.status === 'completed' ||
      order.status === 'departed' ||
      order.status === 'cancelled'
    ) {
      throw new BadRequestException('当前状态不可取消');
    }

    const updated = await this.prisma.booking.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
    });
    return this.toMiniOrder(updated);
  }

  private genOrderNo() {
    return `HD${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  }

  private toMiniOrder(order: {
    id: string;
    orderNo: string;
    shipName: string;
    boatId: string | null;
    coverImage: string;
    price: string;
    wharf: string;
    departWharf: string;
    date: string;
    people: number;
    captainName: string;
    status: BookingStatus;
    createdAt: Date;
  }) {
    return {
      id: order.id,
      orderNo: order.orderNo,
      shipName: order.shipName,
      boatId: order.boatId || '',
      coverImage: order.coverImage,
      price: order.price,
      wharf: order.wharf,
      departWharf: order.departWharf,
      date: order.date,
      people: String(order.people),
      captainName: order.captainName,
      status: order.status,
      statusLabel: STATUS_LABEL[order.status],
      createdAt: order.createdAt.getTime(),
    };
  }
}

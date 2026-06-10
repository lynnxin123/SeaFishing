import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, BookingType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../users/rewards.service';
import { BookingRulesService } from './booking-rules.service';
import { ACTIVE_BOOKING_STATUSES } from './booking-rules.config';
import { isTestOpenid, validateContact } from '../common/contact.util';
import { CancelBookingDto } from './dto/cancel-booking.dto';
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
  bookingType: true,
  sailSlotId: true,
  slotTime: true,
  departureAt: true,
  totalAmount: true,
  refundAmount: true,
  refundPercent: true,
  cancelledAt: true,
  cancelReason: true,
  cancelType: true,
  noShow: true,
  isHoliday: true,
  createdAt: true,
} as const;

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_pay: '待付款',
  pending_accept: '待接单',
  accepted: '已接单',
  departed: '待出海',
  completed: '已完成',
  cancelled: '已取消',
  no_show: '爽约',
};

const CANCELABLE_STATUSES: BookingStatus[] = [
  'pending_pay',
  'pending_accept',
  'accepted',
];

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
    private readonly rules: BookingRulesService,
  ) {}

  async getPublicRules() {
    const rules = await this.rules.getRules();
    return this.rules.buildRulesSummary(rules);
  }

  async getSlotAvailability(boatId: string, date: string) {
    return this.rules.getSlotAvailability(boatId, date);
  }

  async canBookPreview(userId: string, dto: CreateBookingDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    const contactCheck = validateContact(
      user.phone,
      user.wechatId,
      isTestOpenid(user.openid),
    );
    if (!contactCheck.ok) {
      throw new BadRequestException(
        contactCheck.reason || '请先填写有效联系方式后再预约',
      );
    }

    const parsed = await this.parseBookingInput(dto);
    const check = await this.rules.canUserBook({
      userId,
      boatRecordId: parsed.boat.id,
      boatBusinessId: parsed.boat.boatId,
      sailSlotId: parsed.sailSlot.id,
      date: dto.date,
      slotTime: parsed.sailSlot.slotTime,
      bookingType: parsed.bookingType,
      people: dto.people,
    });
    return check;
  }

  async list(userId: string, status?: string, page = 1, pageSize = 20) {
    const where: { userId: string; status?: BookingStatus } = { userId };
    if (status && status !== 'all' && status in STATUS_LABEL) {
      where.status = status as BookingStatus;
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));
    const rules = await this.rules.getRules();

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
      items: orders.map((order) => this.toMiniOrder(order, rules, true)),
    };
  }

  async detail(userId: string, orderId: string) {
    const order = await this.prisma.booking.findFirst({
      where: { id: orderId, userId },
      select: BOOKING_SELECT,
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const rules = await this.rules.getRules();
    return this.toMiniOrder(order, rules, true);
  }

  async cancelPreview(userId: string, orderId: string) {
    const order = await this.requireOrder(userId, orderId);
    const rules = await this.rules.getRules();
    const policy = this.rules.evaluateCancelPolicy(order, rules);
    return {
      orderId: order.id,
      orderNo: order.orderNo,
      ...policy,
      totalAmount: Number(order.totalAmount),
      rulesSummary: rules.cancelTiers,
    };
  }

  async create(userId: string, dto: CreateBookingDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    const contactCheck = validateContact(
      user.phone,
      user.wechatId,
      isTestOpenid(user.openid),
    );
    if (!contactCheck.ok) {
      throw new BadRequestException(
        contactCheck.reason || '请先填写有效联系方式后再预约',
      );
    }

    const parsed = await this.parseBookingInput(dto);
    const rules = await this.rules.getRules();

    const canBook = await this.rules.canUserBook({
      userId,
      boatRecordId: parsed.boat.id,
      boatBusinessId: parsed.boat.boatId,
      sailSlotId: parsed.sailSlot.id,
      date: dto.date,
      slotTime: parsed.sailSlot.slotTime,
      bookingType: parsed.bookingType,
      people: dto.people,
    });
    if (!canBook.allowed) {
      throw new BadRequestException(canBook.reason || '当前不可预约');
    }

    const departureAt = this.rules.buildDepartureAt(
      dto.date,
      parsed.sailSlot.slotTime,
    );
    const isHoliday = this.rules.isHolidayDate(dto.date, rules);
    const totalAmount = this.rules.calcTotalAmount(
      parsed.bookingType,
      dto.people,
      Number(parsed.slotConfig.priceShared),
      Number(parsed.slotConfig.priceCharter),
      Number(parsed.boat.price),
    );

    const order = await this.prisma.$transaction(async (tx) => {
      const dup = await tx.booking.count({
        where: {
          userId,
          date: dto.date,
          slotTime: parsed.sailSlot.slotTime,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
        },
      });
      if (dup > 0) {
        throw new BadRequestException('同一天同一时段已有预约');
      }

      await this.rules.reserveInventory(tx, {
        boatId: parsed.boat.id,
        sailSlotId: parsed.sailSlot.id,
        sailDate: dto.date,
        bookingType: parsed.bookingType,
        people: dto.people,
      });

      const created = await tx.booking.create({
        data: {
          orderNo: this.genOrderNo(),
          userId,
          boatId: parsed.boat.id,
          shipName: dto.shipName || parsed.boat.shipName,
          coverImage: dto.coverImage || this.firstImage(parsed.boat.images),
          price: String(totalAmount),
          wharf: dto.wharf || parsed.boat.wharf,
          departWharf: dto.departWharf || parsed.boat.displayWharf,
          date: dto.date,
          people: dto.people,
          captainName: dto.captainName || parsed.boat.captain,
          status: BookingStatus.pending_pay,
          bookingType: parsed.bookingType,
          sailSlotId: parsed.sailSlot.id,
          slotTime: parsed.sailSlot.slotTime,
          departureAt,
          totalAmount,
          isHoliday,
        },
        select: BOOKING_SELECT,
      });

      await this.rewardsService.grantInTransaction(tx, userId, {
        type: 'booking_create',
        points: 10,
        fishFood: 1,
        remark: `预约船只：${created.shipName}`,
      });

      return created;
    });

    return this.toMiniOrder(order, rules, true);
  }

  async syncBatch(userId: string, items: CreateBookingDto[]) {
    let synced = 0;
    for (const item of (items || []).slice(0, 30)) {
      try {
        await this.create(userId, item);
        synced += 1;
      } catch {
        // 跳过不合规的本地草稿
      }
    }
    return { synced };
  }

  /** 用户完成付款：待付款 → 待接单（正式上线后对接微信支付回调） */
  async pay(userId: string, orderId: string) {
    const order = await this.requireOrder(userId, orderId);
    if (order.status !== 'pending_pay') {
      throw new BadRequestException('当前订单无需付款或已付款');
    }

    const updated = await this.prisma.booking.update({
      where: { id: orderId },
      data: {
        status: 'pending_accept',
        paidAt: new Date(),
      },
      select: BOOKING_SELECT,
    });

    const rules = await this.rules.getRules();
    return this.toMiniOrder(updated, rules, true);
  }

  async cancel(userId: string, orderId: string, dto: CancelBookingDto = {}) {
    const order = await this.requireOrder(userId, orderId);
    const rules = await this.rules.getRules();
    const policy = this.rules.evaluateCancelPolicy(order, rules, {
      cancelType: dto.cancelType,
    });

    if (!policy.canCancel) {
      throw new BadRequestException(policy.reason || '当前不可取消');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.booking.findFirst({
        where: { id: orderId, userId },
      });
      if (!fresh || !CANCELABLE_STATUSES.includes(fresh.status)) {
        throw new BadRequestException('当前状态不可取消');
      }

      await this.rules.releaseInventory(tx, fresh);

      return tx.booking.update({
        where: { id: orderId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: dto.reason || policy.tierLabel,
          cancelType: dto.cancelType || 'user',
          refundPercent: policy.refundPercent,
          refundAmount: policy.refundAmount,
        },
        select: BOOKING_SELECT,
      });
    });

    return this.toMiniOrder(updated, rules, true);
  }

  private async parseBookingInput(dto: CreateBookingDto) {
    if (!dto.boatId) {
      throw new BadRequestException('请选择船只');
    }
    if (!dto.sailSlotId && !dto.slotTime) {
      throw new BadRequestException('请选择出航时段');
    }

    const boat = await this.rules.resolveBoat(dto.boatId);
    let sailSlot;
    if (dto.sailSlotId) {
      sailSlot = await this.rules.resolveSailSlot(dto.sailSlotId);
    } else {
      sailSlot = await this.prisma.sailSlot.findFirst({
        where: { slotTime: dto.slotTime, active: true },
      });
      if (!sailSlot) {
        throw new BadRequestException('出航时段无效');
      }
    }

    const slotConfig = await this.prisma.boatSailConfig.findUnique({
      where: {
        boatId_sailSlotId: { boatId: boat.id, sailSlotId: sailSlot.id },
      },
    });
    if (!slotConfig?.active) {
      throw new BadRequestException('该船未开放此时段');
    }

    const bookingType =
      dto.bookingType === 'charter'
        ? BookingType.charter
        : BookingType.shared;

    if (
      bookingType === BookingType.charter &&
      dto.people > boat.maxNum
    ) {
      throw new BadRequestException('包船人数超过船舶上限');
    }

    const rules = await this.rules.getRules();
    await this.rules.ensureInventoryRow(
      boat.id,
      sailSlot.id,
      dto.date,
      rules,
    );

    return { boat, sailSlot, slotConfig, bookingType };
  }

  private async requireOrder(userId: string, orderId: string) {
    const order = await this.prisma.booking.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    return order;
  }

  private genOrderNo() {
    return `HD${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  }

  private firstImage(images: Prisma.JsonValue) {
    if (Array.isArray(images) && images.length) {
      return String(images[0]);
    }
    return '/images/boat1.jpg';
  }

  private toMiniOrder(
    order: {
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
      bookingType?: BookingType;
      sailSlotId?: string | null;
      slotTime?: string;
      departureAt?: Date | null;
      totalAmount?: Prisma.Decimal;
      refundAmount?: Prisma.Decimal;
      refundPercent?: number;
      cancelledAt?: Date | null;
      cancelReason?: string;
      cancelType?: string;
      noShow?: boolean;
      isHoliday?: boolean;
      createdAt: Date;
    },
    rules?: Awaited<ReturnType<BookingRulesService['getRules']>>,
    withCancel = false,
  ) {
    const policy =
      withCancel && rules
        ? this.rules.evaluateCancelPolicy(
            {
              departureAt: order.departureAt || null,
              date: order.date,
              slotTime: order.slotTime || '',
              isHoliday: order.isHoliday || false,
              totalAmount: Number(order.totalAmount) || Number(order.price) || 0,
              status: order.status,
            },
            rules,
          )
        : null;

    const bookingTypeLabel =
      order.bookingType === 'charter' ? '包船' : '散拼';

    return {
      id: order.id,
      orderNo: order.orderNo,
      shipName: order.shipName,
      boatId: order.boatId || '',
      coverImage: order.coverImage,
      price: order.price,
      totalAmount: Number(order.totalAmount || order.price || 0),
      wharf: order.wharf,
      departWharf: order.departWharf,
      date: order.date,
      slotTime: order.slotTime || '',
      bookingType: order.bookingType || 'shared',
      bookingTypeLabel,
      people: String(order.people),
      captainName: order.captainName,
      status: order.status,
      statusLabel: STATUS_LABEL[order.status],
      noShow: !!order.noShow,
      isHoliday: !!order.isHoliday,
      refundAmount: Number(order.refundAmount || 0),
      refundPercent: order.refundPercent || 0,
      cancelledAt: order.cancelledAt?.getTime() || null,
      cancelReason: order.cancelReason || '',
      createdAt: order.createdAt.getTime(),
      canCancel: policy ? policy.canCancel : CANCELABLE_STATUSES.includes(order.status),
      cancelInfo: policy
        ? {
            canCancel: policy.canCancel,
            refundPercent: policy.refundPercent,
            refundAmount: policy.refundAmount,
            tierLabel: policy.tierLabel,
            reason: policy.reason,
            hoursUntilDeparture: ['cancelled', 'no_show', 'departed', 'completed'].includes(
              order.status,
            )
              ? null
              : Math.round(policy.hoursUntilDeparture * 10) / 10,
          }
        : null,
    };
  }
}

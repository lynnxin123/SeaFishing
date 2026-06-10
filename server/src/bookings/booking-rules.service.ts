import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BookingType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACTIVE_BOOKING_STATUSES,
  BookingRulesData,
  COUNTABLE_BOOKING_STATUSES,
  DEFAULT_BOOKING_RULES,
} from './booking-rules.config';

export type CanBookResult = {
  allowed: boolean;
  reason?: string;
  code?: string;
};

export type CancelPolicyResult = {
  canCancel: boolean;
  refundPercent: number;
  refundAmount: number;
  tierLabel: string;
  reason?: string;
  hoursUntilDeparture: number;
};

export type NoShowCheckResult = {
  isRestricted: boolean;
  restrictedUntil?: string;
  noShowCount: number;
  reason?: string;
};

@Injectable()
export class BookingRulesService {
  private rulesCache: { data: BookingRulesData; version: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** 读取规则（后台可配置，缺省用默认值） */
  async getRules(): Promise<BookingRulesData> {
    const row = await this.prisma.bookingRuleConfig.findUnique({
      where: { id: 'default' },
      select: { rules: true, updatedAt: true },
    });
    const version = row?.updatedAt?.getTime() || 0;
    if (this.rulesCache && this.rulesCache.version === version) {
      return this.rulesCache.data;
    }
    const merged = !row?.rules
      ? { ...DEFAULT_BOOKING_RULES }
      : {
          ...DEFAULT_BOOKING_RULES,
          ...(row.rules as BookingRulesData),
          cancelTiers:
            (row.rules as BookingRulesData).cancelTiers ||
            DEFAULT_BOOKING_RULES.cancelTiers,
          noShowPenalty:
            (row.rules as BookingRulesData).noShowPenalty ||
            DEFAULT_BOOKING_RULES.noShowPenalty,
        };
    this.rulesCache = { data: merged, version };
    return merged;
  }

  buildDepartureAt(date: string, slotTime: string): Date {
    const normalized = slotTime.length === 5 ? `${slotTime}:00` : slotTime;
    return new Date(`${date}T${normalized}+08:00`);
  }

  isHolidayDate(date: string, rules: BookingRulesData): boolean {
    return (rules.holidays || []).includes(date);
  }

  /** 判断出航时段是否仍在可预约时间窗内 */
  evaluateBookingWindow(
    date: string,
    slotTime: string,
    rules: BookingRulesData,
    now = new Date(),
  ): {
    allowed: boolean;
    reason?: string;
    code?: string;
    hoursUntilDeparture: number;
  } {
    const departureAt = this.buildDepartureAt(date, slotTime);
    const hoursUntil =
      (departureAt.getTime() - now.getTime()) / (60 * 60 * 1000);
    const minLead =
      rules.minBookingLeadHours ?? DEFAULT_BOOKING_RULES.minBookingLeadHours;

    if (hoursUntil <= 0) {
      return {
        allowed: false,
        code: 'DEPARTURE_PASSED',
        reason: '该时段已出航，无法预约',
        hoursUntilDeparture: hoursUntil,
      };
    }
    if (hoursUntil < minLead) {
      return {
        allowed: false,
        code: 'BOOKING_CUTOFF',
        reason: `需提前至少${minLead}小时预约`,
        hoursUntilDeparture: hoursUntil,
      };
    }
    return { allowed: true, hoursUntilDeparture: hoursUntil };
  }

  /**
   * 函数1：判断当前用户能否预约（重复 + 次数 + 库存 + 爽约限制）
   */
  async canUserBook(params: {
    userId: string;
    boatRecordId: string;
    boatBusinessId: string;
    sailSlotId: string;
    date: string;
    slotTime: string;
    bookingType: BookingType;
    people: number;
  }): Promise<CanBookResult> {
    const rules = await this.getRules();
    const restriction = await this.checkUserRestriction(params.userId);
    if (restriction.isRestricted) {
      return {
        allowed: false,
        code: 'RESTRICTED',
        reason:
          restriction.reason ||
          `预约受限至 ${restriction.restrictedUntil || ''}`,
      };
    }

    const duplicate = await this.prisma.booking.count({
      where: {
        userId: params.userId,
        date: params.date,
        slotTime: params.slotTime,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
    });
    if (duplicate > 0) {
      return {
        allowed: false,
        code: 'DUPLICATE_SLOT',
        reason: '同一天同一时段已有预约，请勿重复下单',
      };
    }

    const sameBoatSlot = await this.prisma.booking.count({
      where: {
        userId: params.userId,
        boatId: params.boatRecordId,
        date: params.date,
        slotTime: params.slotTime,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
    });
    if (sameBoatSlot > 0) {
      return {
        allowed: false,
        code: 'DUPLICATE_BOAT_SLOT',
        reason: '您已预约该船该时段，请勿重复下单',
      };
    }

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const recentCount = await this.prisma.booking.count({
      where: {
        userId: params.userId,
        createdAt: { gte: since },
        status: { in: [...COUNTABLE_BOOKING_STATUSES] },
      },
    });
    if (recentCount >= rules.maxBookingsIn7Days) {
      return {
        allowed: false,
        code: 'WEEKLY_LIMIT',
        reason: `7天内最多预约${rules.maxBookingsIn7Days}次，您已达上限`,
      };
    }

    const slotConfig = await this.prisma.boatSailConfig.findUnique({
      where: {
        boatId_sailSlotId: {
          boatId: params.boatRecordId,
          sailSlotId: params.sailSlotId,
        },
      },
      include: { sailSlot: true },
    });
    if (!slotConfig || !slotConfig.active) {
      return { allowed: false, code: 'NO_SLOT', reason: '该时段不可预约' };
    }

    const bookingWindow = this.evaluateBookingWindow(
      params.date,
      params.slotTime,
      rules,
    );
    if (!bookingWindow.allowed) {
      return {
        allowed: false,
        code: bookingWindow.code,
        reason: bookingWindow.reason,
      };
    }

    const inventory = await this.ensureInventoryRow(
      params.boatRecordId,
      params.sailSlotId,
      params.date,
      rules,
    );
    if (inventory.maritimeBlocked) {
      return {
        allowed: false,
        code: 'MARITIME_BLOCKED',
        reason: '该时段因天气/海事禁航暂停预约',
      };
    }

    if (params.bookingType === BookingType.charter) {
      if (inventory.bookedOrders >= slotConfig.maxOrders) {
        return {
          allowed: false,
          code: 'SOLD_OUT',
          reason: '该时段包船已约满',
        };
      }
    } else {
      const remaining = slotConfig.maxPeople - inventory.bookedPeople;
      if (params.people > remaining) {
        return {
          allowed: false,
          code: 'INSUFFICIENT_STOCK',
          reason:
            remaining <= 0
              ? '该时段散拼已约满'
              : `该时段仅剩${remaining}个名额`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 函数2：判断订单能否取消、退款比例
   */
  evaluateCancelPolicy(
    order: {
      departureAt: Date | null;
      date: string;
      slotTime: string;
      isHoliday: boolean;
      totalAmount: Prisma.Decimal | number;
      status: BookingStatus;
    },
    rules: BookingRulesData,
    options?: { cancelType?: string; now?: Date },
  ): CancelPolicyResult {
    const now = options?.now || new Date();
    const total = Number(order.totalAmount) || 0;

    const departureAt =
      order.departureAt ||
      this.buildDepartureAt(order.date, order.slotTime || '08:00');
    const hoursUntil = (departureAt.getTime() - now.getTime()) / 3600000;

    let policy: CancelPolicyResult;

    if (order.status === 'cancelled' || order.status === 'no_show') {
      policy = {
        canCancel: false,
        refundPercent: 0,
        refundAmount: 0,
        tierLabel: '已结束',
        reason: '订单已结束',
        hoursUntilDeparture: 0,
      };
    } else if (order.status === 'departed' || order.status === 'completed') {
      policy = {
        canCancel: false,
        refundPercent: 0,
        refundAmount: 0,
        tierLabel: '已出港',
        reason: '船只已出港，不可取消',
        hoursUntilDeparture: 0,
      };
    } else if (options?.cancelType === 'weather') {
      policy = {
        canCancel: true,
        refundPercent: 100,
        refundAmount: total,
        tierLabel: '天气/禁航取消，全额退款或免费改期',
        hoursUntilDeparture: hoursUntil,
      };
    } else if (hoursUntil < 0) {
      policy = {
        canCancel: false,
        refundPercent: 0,
        refundAmount: 0,
        tierLabel: '已过出航时间',
        reason: '已过出航时间，不可取消',
        hoursUntilDeparture: hoursUntil,
      };
    } else if (order.isHoliday && rules.holidayNoCancel) {
      policy = {
        canCancel: false,
        refundPercent: 0,
        refundAmount: 0,
        tierLabel: '节假日订单',
        reason: '节假日订单默认不可取消',
        hoursUntilDeparture: hoursUntil,
      };
    } else {
      const tiers = [...rules.cancelTiers].sort((a, b) => b.minHours - a.minHours);
      let matched: CancelPolicyResult | null = null;
      for (const tier of tiers) {
        if (hoursUntil >= tier.minHours) {
          const refundPercent = tier.canCancel ? tier.refundPercent : 0;
          matched = {
            canCancel: tier.canCancel,
            refundPercent,
            refundAmount:
              Math.round(((total * refundPercent) / 100) * 100) / 100,
            tierLabel: tier.label,
            reason: tier.canCancel ? undefined : tier.label,
            hoursUntilDeparture: hoursUntil,
          };
          break;
        }
      }
      policy = matched || {
        canCancel: false,
        refundPercent: 0,
        refundAmount: 0,
        tierLabel: '不可取消',
        reason: '已过可取消时间',
        hoursUntilDeparture: hoursUntil,
      };
    }

    return this.normalizeCancelPolicy(policy, order.status);
  }

  /** 待付款订单按同一套时间规则判断；可取消时不扣款 */
  private normalizeCancelPolicy(
    policy: CancelPolicyResult,
    status: BookingStatus,
  ): CancelPolicyResult {
    if (status !== 'pending_pay' || !policy.canCancel) {
      return policy;
    }
    return {
      ...policy,
      refundPercent: 100,
      refundAmount: 0,
      tierLabel: `${policy.tierLabel}；未付款，取消无需扣款`,
    };
  }

  /**
   * 函数3：爽约限制判断
   */
  async checkUserRestriction(userId: string): Promise<NoShowCheckResult> {
    const stat = await this.prisma.userBookingStat.findUnique({
      where: { userId },
    });
    if (!stat) {
      return { isRestricted: false, noShowCount: 0 };
    }
    if (stat.restrictedUntil && stat.restrictedUntil > new Date()) {
      return {
        isRestricted: true,
        noShowCount: stat.noShowCount,
        restrictedUntil: stat.restrictedUntil.toISOString(),
        reason: `累计爽约${stat.noShowCount}次，预约限制至${stat.restrictedUntil.toLocaleString('zh-CN')}`,
      };
    }
    return { isRestricted: false, noShowCount: stat.noShowCount };
  }

  /** 标记爽约并更新惩罚 */
  async markNoShow(userId: string, bookingId: string) {
    const rules = await this.getRules();
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.booking.findFirst({
        where: { id: bookingId, userId },
      });
      if (!order || order.noShow || order.status === 'cancelled') {
        return;
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'no_show', noShow: true },
      });

      await tx.userBookingStat.upsert({
        where: { userId },
        create: { userId, noShowCount: 1 },
        update: { noShowCount: { increment: 1 } },
      });
      const statRow = await tx.userBookingStat.findUnique({
        where: { userId },
      });
      const newCount = statRow?.noShowCount || 1;

      let restrictedUntil: Date | null = null;
      if (newCount >= 3) {
        restrictedUntil = new Date();
        restrictedUntil.setDate(
          restrictedUntil.getDate() + rules.noShowPenalty.count3RestrictDays,
        );
      } else if (newCount >= 2) {
        restrictedUntil = new Date();
        restrictedUntil.setDate(
          restrictedUntil.getDate() + rules.noShowPenalty.count2RestrictDays,
        );
      }

      if (restrictedUntil) {
        await tx.userBookingStat.update({
          where: { userId },
          data: { restrictedUntil },
        });
      }
    });
  }

  async getSlotAvailability(boatBusinessId: string, date: string) {
    const boat = await this.resolveBoat(boatBusinessId);
    const rules = await this.getRules();
    const configs = await this.prisma.boatSailConfig.findMany({
      where: { boatId: boat.id, active: true },
      include: { sailSlot: true },
      orderBy: { sailSlot: { sortOrder: 'asc' } },
    });

    const activeConfigs = configs.filter((cfg) => cfg.sailSlot.active);
    const isHoliday = this.isHolidayDate(date, rules);
    const slotIds = activeConfigs.map((cfg) => cfg.sailSlotId);
    const invMap = await this.ensureInventoryRowsBatch(
      boat.id,
      slotIds,
      date,
      isHoliday,
    );

    const slots: Array<{
      sailSlotId: string;
      slotKey: string;
      slotTime: string;
      label: string;
      maxPeople: number;
      maxOrders: number;
      bookedPeople: number;
      bookedOrders: number;
      remainingPeople: number;
      remainingOrders: number;
      availableShared: boolean;
      availableCharter: boolean;
      priceShared: number;
      priceCharter: number;
      maritimeBlocked: boolean;
      isHoliday: boolean;
      bookingClosed: boolean;
      bookingClosedReason?: string;
    }> = [];
    for (const cfg of activeConfigs) {
      const inv = invMap.get(cfg.sailSlotId);
      if (!inv) continue;
      const remainingPeople = Math.max(0, cfg.maxPeople - inv.bookedPeople);
      const remainingOrders = Math.max(0, cfg.maxOrders - inv.bookedOrders);
      const bookingWindow = this.evaluateBookingWindow(
        date,
        cfg.sailSlot.slotTime,
        rules,
      );
      const timeClosed = !bookingWindow.allowed;
      slots.push({
        sailSlotId: cfg.sailSlotId,
        slotKey: cfg.sailSlot.slotKey,
        slotTime: cfg.sailSlot.slotTime,
        label: cfg.sailSlot.label,
        maxPeople: cfg.maxPeople,
        maxOrders: cfg.maxOrders,
        bookedPeople: inv.bookedPeople,
        bookedOrders: inv.bookedOrders,
        remainingPeople,
        remainingOrders,
        availableShared:
          remainingPeople > 0 && !inv.maritimeBlocked && !timeClosed,
        availableCharter:
          remainingOrders > 0 && !inv.maritimeBlocked && !timeClosed,
        priceShared: Number(cfg.priceShared),
        priceCharter: Number(cfg.priceCharter),
        maritimeBlocked: inv.maritimeBlocked,
        isHoliday: inv.isHoliday,
        bookingClosed: timeClosed,
        bookingClosedReason: bookingWindow.reason,
      });
    }
    return {
      boatId: boat.boatId,
      date,
      isHoliday: this.isHolidayDate(date, rules),
      rulesSummary: this.buildRulesSummary(rules),
      slots,
    };
  }

  buildRulesSummary(rules: BookingRulesData) {
    return {
      minBookingLeadHours:
        rules.minBookingLeadHours ?? DEFAULT_BOOKING_RULES.minBookingLeadHours,
      maxBookingsIn7Days: rules.maxBookingsIn7Days,
      cancelTiers: rules.cancelTiers,
      holidayNoCancel: rules.holidayNoCancel,
      noShowPenalty: rules.noShowPenalty,
    };
  }

  async resolveBoat(boatKey: string) {
    const boat = await this.prisma.boat.findFirst({
      where: { OR: [{ boatId: boatKey }, { id: boatKey }], active: true },
    });
    if (!boat) {
      throw new NotFoundException('船只不存在');
    }
    return boat;
  }

  async resolveSailSlot(sailSlotId: string) {
    const slot = await this.prisma.sailSlot.findFirst({
      where: {
        OR: [{ id: sailSlotId }, { slotKey: sailSlotId }],
        active: true,
      },
    });
    if (!slot) {
      throw new BadRequestException('出航时段无效');
    }
    return slot;
  }

  calcTotalAmount(
    bookingType: BookingType,
    people: number,
    priceShared: number,
    priceCharter: number,
    fallbackPrice: number,
  ): number {
    if (bookingType === BookingType.charter) {
      return priceCharter || fallbackPrice;
    }
    const unit = priceShared || fallbackPrice;
    return Math.round(unit * people * 100) / 100;
  }

  async ensureInventoryRow(
    boatId: string,
    sailSlotId: string,
    sailDate: string,
    rules: BookingRulesData,
  ) {
    const isHoliday = this.isHolidayDate(sailDate, rules);
    return this.prisma.slotInventory.upsert({
      where: {
        boatId_sailSlotId_sailDate: { boatId, sailSlotId, sailDate },
      },
      create: {
        boatId,
        sailSlotId,
        sailDate,
        isHoliday,
      },
      update: { isHoliday },
    });
  }

  /** 批量确保库存行，避免时段查询 N+1 */
  private async ensureInventoryRowsBatch(
    boatId: string,
    sailSlotIds: string[],
    sailDate: string,
    isHoliday: boolean,
  ) {
    const map = new Map<
      string,
      {
        bookedPeople: number;
        bookedOrders: number;
        maritimeBlocked: boolean;
        isHoliday: boolean;
      }
    >();
    if (!sailSlotIds.length) return map;

    const existing = await this.prisma.slotInventory.findMany({
      where: { boatId, sailDate, sailSlotId: { in: sailSlotIds } },
    });
    existing.forEach((row) => map.set(row.sailSlotId, row));

    const missing = sailSlotIds.filter((id) => !map.has(id));
    if (missing.length) {
      await this.prisma.slotInventory.createMany({
        data: missing.map((sailSlotId) => ({
          boatId,
          sailSlotId,
          sailDate,
          isHoliday,
        })),
        skipDuplicates: true,
      });
      const created = await this.prisma.slotInventory.findMany({
        where: { boatId, sailDate, sailSlotId: { in: missing } },
      });
      created.forEach((row) => map.set(row.sailSlotId, row));
    }

    const staleHoliday = existing.filter((row) => row.isHoliday !== isHoliday);
    if (staleHoliday.length) {
      await this.prisma.slotInventory.updateMany({
        where: { id: { in: staleHoliday.map((r) => r.id) } },
        data: { isHoliday },
      });
      staleHoliday.forEach((row) => {
        map.set(row.sailSlotId, { ...row, isHoliday });
      });
    }

    return map;
  }

  async reserveInventory(
    tx: Prisma.TransactionClient,
    params: {
      boatId: string;
      sailSlotId: string;
      sailDate: string;
      bookingType: BookingType;
      people: number;
    },
  ) {
    const config = await tx.boatSailConfig.findUnique({
      where: {
        boatId_sailSlotId: {
          boatId: params.boatId,
          sailSlotId: params.sailSlotId,
        },
      },
    });
    if (!config) {
      throw new BadRequestException('时段配置不存在');
    }

    const inv = await tx.slotInventory.findUnique({
      where: {
        boatId_sailSlotId_sailDate: {
          boatId: params.boatId,
          sailSlotId: params.sailSlotId,
          sailDate: params.sailDate,
        },
      },
    });
    if (!inv) {
      throw new BadRequestException('库存记录不存在');
    }
    if (inv.maritimeBlocked) {
      throw new BadRequestException('该时段因禁航不可预约');
    }

    if (params.bookingType === BookingType.charter) {
      const charterResult = await tx.slotInventory.updateMany({
        where: {
          id: inv.id,
          bookedOrders: { lt: config.maxOrders },
        },
        data: {
          bookedOrders: { increment: 1 },
          bookedPeople: { increment: config.maxPeople },
        },
      });
      if (charterResult.count === 0) {
        throw new BadRequestException('包船名额已满');
      }
    } else {
      const sharedResult = await tx.slotInventory.updateMany({
        where: {
          id: inv.id,
          bookedPeople: { lte: config.maxPeople - params.people },
        },
        data: {
          bookedPeople: { increment: params.people },
          bookedOrders: { increment: 1 },
        },
      });
      if (sharedResult.count === 0) {
        throw new BadRequestException('散拼名额不足');
      }
    }
  }

  async releaseInventory(
    tx: Prisma.TransactionClient,
    order: {
      boatId: string | null;
      sailSlotId: string | null;
      date: string;
      bookingType: BookingType;
      people: number;
    },
  ) {
    if (!order.boatId || !order.sailSlotId) return;

    const config = await tx.boatSailConfig.findUnique({
      where: {
        boatId_sailSlotId: {
          boatId: order.boatId,
          sailSlotId: order.sailSlotId,
        },
      },
    });
    if (!config) return;

    const inv = await tx.slotInventory.findUnique({
      where: {
        boatId_sailSlotId_sailDate: {
          boatId: order.boatId,
          sailSlotId: order.sailSlotId,
          sailDate: order.date,
        },
      },
    });
    if (!inv) return;

    if (order.bookingType === BookingType.charter) {
      await tx.slotInventory.update({
        where: { id: inv.id },
        data: {
          bookedOrders: { decrement: 1 },
          bookedPeople: { decrement: config.maxPeople },
        },
      });
    } else {
      await tx.slotInventory.update({
        where: { id: inv.id },
        data: {
          bookedPeople: { decrement: order.people },
          bookedOrders: { decrement: 1 },
        },
      });
    }
  }
}

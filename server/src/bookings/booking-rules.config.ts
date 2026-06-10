/**
 * 预约/取消/爽约规则默认配置（后台 BookingRuleConfig 表可覆盖）
 */
export type CancelTier = {
  minHours: number;
  refundPercent: number;
  canCancel: boolean;
  label: string;
};

export type BookingRulesData = {
  /** 距出航至少提前多少小时方可预约（0 表示仅禁止已过出航时间的时段） */
  minBookingLeadHours: number;
  /** 7天内最多预约次数（不含已取消/爽约） */
  maxBookingsIn7Days: number;
  cancelTiers: CancelTier[];
  /** 节假日订单默认不可取消（天气/禁航除外） */
  holidayNoCancel: boolean;
  /** 节假日日期 YYYY-MM-DD */
  holidays: string[];
  noShowPenalty: {
    count2RestrictDays: number;
    count3RestrictDays: number;
  };
};

export const DEFAULT_BOOKING_RULES: BookingRulesData = {
  minBookingLeadHours: 2,
  maxBookingsIn7Days: 2,
  cancelTiers: [
    {
      minHours: 72,
      refundPercent: 100,
      canCancel: true,
      label: '出航前72小时以上，全额退款',
    },
    {
      minHours: 48,
      refundPercent: 50,
      canCancel: true,
      label: '出航前48-72小时，退款50%',
    },
    {
      minHours: 24,
      refundPercent: 20,
      canCancel: true,
      label: '出航前24-48小时，退款20%',
    },
    {
      minHours: 0,
      refundPercent: 0,
      canCancel: false,
      label: '出航前24小时内，不可取消',
    },
  ],
  holidayNoCancel: true,
  holidays: [],
  noShowPenalty: {
    count2RestrictDays: 7,
    count3RestrictDays: 30,
  },
};

/** 计入「未完成」、占用重复预约名额的订单状态 */
export const ACTIVE_BOOKING_STATUSES = [
  'pending_pay',
  'pending_accept',
  'accepted',
  'departed',
] as const;

/** 计入7天预约次数上限的状态 */
export const COUNTABLE_BOOKING_STATUSES = [
  'pending_pay',
  'pending_accept',
  'accepted',
  'departed',
  'completed',
] as const;

/** 已付款（待接单及之后流程）的订单状态，用于实付金额汇总 */
export const PAID_BOOKING_STATUSES = [
  'pending_accept',
  'accepted',
  'departed',
  'completed',
  'no_show',
] as const;

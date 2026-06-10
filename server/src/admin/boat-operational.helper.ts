import { BookingStatus } from '@prisma/client';

export type BoatOperationalStatus =
  | 'at_sea'
  | 'awaiting_departure'
  | 'at_port'
  | 'inactive';

export type BoatScheduleItem = {
  date: string;
  slotTime: string;
  people: number;
  status: BookingStatus;
  statusLabel: string;
  orderNo: string;
};

export type BoatTodayTrip = {
  date: string;
  slotTime: string;
  people: number;
  status: BookingStatus;
  statusLabel: string;
  orderNo: string;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_pay: '待付款',
  pending_accept: '待接单',
  accepted: '已接单',
  departed: '出港中',
  completed: '已完成',
  cancelled: '已取消',
  no_show: '爽约',
};

const SCHEDULE_STATUSES: BookingStatus[] = [
  'pending_accept',
  'accepted',
  'departed',
  'completed',
];

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function formatScheduleDate(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

export function buildMonthScheduleSummary(items: BoatScheduleItem[]): string {
  if (!items.length) return '暂无排期';
  return items
    .slice(0, 4)
    .map(
      (item) =>
        `${formatScheduleDate(item.date)} ${item.slotTime || '—'}·${item.people}人(${item.statusLabel})`,
    )
    .join('；');
}

type BookingRow = {
  boatId: string | null;
  date: string;
  slotTime: string;
  people: number;
  status: BookingStatus;
  orderNo: string;
};

export function enrichBoatOperational(
  boat: { id: string; active: boolean },
  bookings: BookingRow[],
  today: string,
  monthEnd: string,
) {
  if (!boat.active) {
    return {
      operationalStatus: 'inactive' as BoatOperationalStatus,
      operationalStatusLabel: '已下架',
      todayTrip: null as BoatTodayTrip | null,
      monthSchedule: [] as BoatScheduleItem[],
      monthScheduleSummary: '—',
      monthTripCount: 0,
    };
  }

  const mine = bookings.filter((b) => b.boatId === boat.id);

  const openDeparted = mine
    .filter((b) => b.status === 'departed')
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (openDeparted) {
    const todayTrip: BoatTodayTrip = {
      date: openDeparted.date,
      slotTime: openDeparted.slotTime,
      people: openDeparted.people,
      status: openDeparted.status,
      statusLabel: STATUS_LABEL.departed,
      orderNo: openDeparted.orderNo,
    };
    const monthSchedule = buildMonthSchedule(mine, today, monthEnd);
    return {
      operationalStatus: 'at_sea' as BoatOperationalStatus,
      operationalStatusLabel: '出港中',
      todayTrip,
      monthSchedule,
      monthScheduleSummary: buildMonthScheduleSummary(monthSchedule),
      monthTripCount: monthSchedule.length,
    };
  }

  const todayPending = mine
    .filter(
      (b) =>
        b.date === today &&
        (b.status === 'pending_accept' || b.status === 'accepted'),
    )
    .sort((a, b) => a.slotTime.localeCompare(b.slotTime))[0];

  if (todayPending) {
    const todayTrip: BoatTodayTrip = {
      date: todayPending.date,
      slotTime: todayPending.slotTime,
      people: todayPending.people,
      status: todayPending.status,
      statusLabel: STATUS_LABEL[todayPending.status],
      orderNo: todayPending.orderNo,
    };
    const monthSchedule = buildMonthSchedule(mine, today, monthEnd);
    return {
      operationalStatus: 'awaiting_departure' as BoatOperationalStatus,
      operationalStatusLabel: '今日待出港',
      todayTrip,
      monthSchedule,
      monthScheduleSummary: buildMonthScheduleSummary(monthSchedule),
      monthTripCount: monthSchedule.length,
    };
  }

  const monthSchedule = buildMonthSchedule(mine, today, monthEnd);
  return {
    operationalStatus: 'at_port' as BoatOperationalStatus,
    operationalStatusLabel: '在港',
    todayTrip: null as BoatTodayTrip | null,
    monthSchedule,
    monthScheduleSummary: buildMonthScheduleSummary(monthSchedule),
    monthTripCount: monthSchedule.length,
  };
}

function buildMonthSchedule(
  mine: BookingRow[],
  today: string,
  monthEnd: string,
): BoatScheduleItem[] {
  return mine
    .filter(
      (b) =>
        SCHEDULE_STATUSES.includes(b.status) &&
        b.date >= today &&
        b.date <= monthEnd,
    )
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.slotTime.localeCompare(b.slotTime);
    })
    .map((b) => ({
      date: b.date,
      slotTime: b.slotTime,
      people: b.people,
      status: b.status,
      statusLabel: STATUS_LABEL[b.status] || b.status,
      orderNo: b.orderNo,
    }));
}

export const BOAT_STATUS_TAG_COLOR: Record<BoatOperationalStatus, string> = {
  at_sea: '#e6a23c',
  awaiting_departure: '#409eff',
  at_port: '#67c23a',
  inactive: '#909399',
};

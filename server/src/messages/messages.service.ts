import { Injectable, NotFoundException } from '@nestjs/common';
import { Booking, BookingStatus, Competition, CompetitionRegistration } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const BOOKING_MSG_TYPES = ['payment_reminder', 'booking_accepted'] as const;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 订单已删或状态变更后，清理失效的预约类消息，避免与订单列表不一致 */
  private async pruneStaleBookingMessages(userId: string) {
    const msgs = await this.prisma.userMessage.findMany({
      where: {
        userId,
        type: { in: [...BOOKING_MSG_TYPES] },
        refId: { not: null },
      },
      select: { id: true, type: true, refId: true },
    });
    if (!msgs.length) return 0;

    const refIds = [...new Set(msgs.map((m) => m.refId!).filter(Boolean))];
    const bookings = await this.prisma.booking.findMany({
      where: { userId, id: { in: refIds } },
      select: { id: true, status: true },
    });
    const byId = new Map(bookings.map((b) => [b.id, b.status]));

    const staleIds: string[] = [];
    for (const m of msgs) {
      const status = m.refId ? byId.get(m.refId) : undefined;
      if (!status) {
        staleIds.push(m.id);
        continue;
      }
      if (m.type === 'payment_reminder' && status !== 'pending_pay') {
        staleIds.push(m.id);
        continue;
      }
      if (
        m.type === 'booking_accepted' &&
        !(['accepted', 'departed', 'completed'] as BookingStatus[]).includes(status)
      ) {
        staleIds.push(m.id);
      }
    }

    if (!staleIds.length) return 0;
    const removed = await this.prisma.userMessage.deleteMany({
      where: { id: { in: staleIds } },
    });
    return removed.count;
  }

  async list(userId: string, page = 1, pageSize = 50) {
    await this.pruneStaleBookingMessages(userId);
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));

    const [total, items] = await Promise.all([
      this.prisma.userMessage.count({ where: { userId } }),
      this.prisma.userMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      total,
      page: safePage,
      pageSize: safePageSize,
      items: items.map((m) => this.toMiniMessage(m)),
    };
  }

  async unreadCount(userId: string) {
    await this.pruneStaleBookingMessages(userId);
    const count = await this.prisma.userMessage.count({
      where: { userId, read: false },
    });
    return { count };
  }

  async markRead(userId: string, messageId: string) {
    const msg = await this.prisma.userMessage.findFirst({
      where: { id: messageId, userId },
    });
    if (!msg) {
      throw new NotFoundException('消息不存在');
    }
    if (msg.read) {
      return this.toMiniMessage(msg);
    }
    const updated = await this.prisma.userMessage.update({
      where: { id: messageId },
      data: { read: true },
    });
    return this.toMiniMessage(updated);
  }

  /** 待付款订单超时未付，提醒用户付款 */
  async notifyPaymentReminder(booking: Booking) {
    const amount = Number(booking.totalAmount) || Number(booking.price) || 0;
    const slot = booking.slotTime ? ` ${booking.slotTime}` : '';
    const title = '请尽快完成付款';
    const summary = `您的「${booking.shipName}」预约尚未付款，请尽快支付 ¥${amount.toFixed(2)}。`;
    const content =
      `您有一笔海钓预约待付款。\n\n` +
      `船舶：${booking.shipName}\n` +
      `出行日期：${booking.date}${slot}\n` +
      `人数：${booking.people}人\n` +
      `应付金额：¥${amount.toFixed(2)}\n\n` +
      `付款后船长才会确认接单，请尽快完成支付以免耽误行程。`;

    return this.prisma.userMessage.create({
      data: {
        userId: booking.userId,
        type: 'payment_reminder',
        title,
        summary,
        content,
        refId: booking.id,
      },
    });
  }

  /** 报名赛事距开赛在提醒窗口内（默认 24 小时）时通知用户 */
  async notifyCompetitionStartReminder(
    registration: CompetitionRegistration,
    competition: Competition,
    hoursUntil: number,
  ) {
    const leadLabel =
      hoursUntil >= 20
        ? '明天'
        : hoursUntil >= 2
          ? `约${Math.round(hoursUntil)}小时后`
          : '即将';
    const title = '赛事即将开始';
    const summary = `您报名的「${competition.name}」${leadLabel}开赛，请提前做好准备。`;
    const content =
      `您已报名的海钓赛事即将开始，请留意集合时间与装备准备。\n\n` +
      `赛事：${competition.name}\n` +
      `时间：${competition.time || '见赛事详情'}\n` +
      `地点：${competition.location || '见赛事详情'}\n` +
      `报名人数：${registration.people}人\n` +
      `联系人：${registration.realName} ${registration.phone}\n\n` +
      `建议提前检查钓具、证件与防晒装备，按赛事公告时间到达集合地点。祝您旗开得胜！`;

    return this.prisma.userMessage.create({
      data: {
        userId: registration.userId,
        type: 'competition_start_reminder',
        title,
        summary,
        content,
        refId: String(competition.legacyId),
      },
    });
  }

  /** 管理后台将订单设为「已接单」时通知用户 */
  async notifyBookingAccepted(booking: Booking) {
    const wharf = booking.departWharf || booking.wharf || '指定';
    const slot = booking.slotTime ? ` ${booking.slotTime}` : '';
    const title = '订单已接单';
    const summary = `您的「${booking.shipName}」预约已由船长确认，请按时出海。`;
    const content =
      `恭喜！您的海钓预约已接单。\n\n` +
      `船舶：${booking.shipName}\n` +
      `出行日期：${booking.date}${slot}\n` +
      `出发码头：${wharf}\n` +
      `人数：${booking.people}人\n\n` +
      `请按预约时间提前到达码头办理登船手续，注意防晒与出海安全。祝您渔获满满、旅途愉快！`;

    return this.prisma.userMessage.create({
      data: {
        userId: booking.userId,
        type: 'booking_accepted',
        title,
        summary,
        content,
        refId: booking.id,
      },
    });
  }

  private toMiniMessage(msg: {
    id: string;
    type: string;
    title: string;
    summary: string;
    content: string;
    read: boolean;
    refId: string | null;
    createdAt: Date;
  }) {
    return {
      id: msg.id,
      type: msg.type,
      title: msg.title,
      summary: msg.summary,
      content: msg.content,
      read: msg.read,
      refId: msg.refId || '',
      time: msg.createdAt
        .toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        .replace(/\//g, '-'),
    };
  }
}

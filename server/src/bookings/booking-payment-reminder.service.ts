import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from '../messages/messages.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingPaymentReminderService implements OnModuleInit {
  private readonly logger = new Logger(BookingPaymentReminderService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    setInterval(() => void this.run(), 60_000);
    setTimeout(() => void this.run(), 15_000);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const minutes = Math.max(
        1,
        Number(this.config.get<string>('PAYMENT_REMINDER_MINUTES') || 3),
      );
      const cutoff = new Date(Date.now() - minutes * 60_000);
      const orders = await this.prisma.booking.findMany({
        where: {
          status: 'pending_pay',
          createdAt: { lte: cutoff },
          paymentRemindedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      for (const order of orders) {
        try {
          await this.messages.notifyPaymentReminder(order);
          await this.prisma.booking.update({
            where: { id: order.id },
            data: { paymentRemindedAt: new Date() },
          });
        } catch (err) {
          this.logger.warn(
            `付款提醒发送失败 order=${order.id}: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Competition, CompetitionRegistration } from '@prisma/client';
import { MessagesService } from '../messages/messages.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  hoursUntilCompetitionStart,
  shouldSendCompetitionStartReminder,
} from './competition-time.helper';

@Injectable()
export class CompetitionStartReminderService implements OnModuleInit {
  private readonly logger = new Logger(CompetitionStartReminderService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    setInterval(() => void this.run(), 60_000);
    setTimeout(() => void this.run(), 20_000);
  }

  getReminderHours(): number {
    return Math.max(
      1,
      Number(this.config.get<string>('COMPETITION_START_REMINDER_HOURS') || 24),
    );
  }

  async trySendStartReminder(
    registration: CompetitionRegistration,
    competition: Competition,
  ): Promise<boolean> {
    if (registration.startRemindedAt) return false;
    if (competition.status === 'ended') return false;

    const hoursUntil = hoursUntilCompetitionStart(competition.time);
    if (
      hoursUntil === null ||
      !shouldSendCompetitionStartReminder(hoursUntil, this.getReminderHours())
    ) {
      return false;
    }

    await this.messages.notifyCompetitionStartReminder(
      registration,
      competition,
      hoursUntil,
    );
    await this.prisma.competitionRegistration.update({
      where: { id: registration.id },
      data: { startRemindedAt: new Date() },
    });
    return true;
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.prisma.competitionRegistration.findMany({
        where: { startRemindedAt: null },
        include: { competition: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      for (const row of rows) {
        try {
          await this.trySendStartReminder(row, row.competition);
        } catch (err) {
          this.logger.warn(
            `赛事开赛提醒失败 reg=${row.id}: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}

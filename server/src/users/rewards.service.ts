import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

const LEVEL_THRESHOLDS = [
  { name: '王者钓手', points: 5000 },
  { name: '钻石钓手', points: 2000 },
  { name: '黄金钓手', points: 800 },
  { name: '白银钓手', points: 300 },
  { name: '青铜钓手', points: 0 },
];

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  resolveLevelName(points: number) {
    for (const item of LEVEL_THRESHOLDS) {
      if (points >= item.points) {
        return item.name;
      }
    }
    return '青铜钓手';
  }

  async grant(
    userId: string,
    payload: {
      type: string;
      points?: number;
      medals?: number;
      fishFood?: number;
      remark?: string;
    },
  ) {
    const user = await this.prisma.$transaction((tx) =>
      this.grantInTransaction(tx, userId, payload),
    );
    return this.authService.toUserProfile(user);
  }

  async grantInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    payload: {
      type: string;
      points?: number;
      medals?: number;
      fishFood?: number;
      remark?: string;
    },
  ) {
    const points = payload.points || 0;
    const medals = payload.medals || 0;
    const fishFood = payload.fishFood || 0;

    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, points: true },
    });
    if (!current) {
      throw new BadRequestException('用户不存在');
    }

    const nextPoints = current.points + points;
    const [user] = await Promise.all([
      tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: points },
          medals: { increment: medals },
          fishFood: { increment: fishFood },
          levelName: this.resolveLevelName(nextPoints),
        },
      }),
      tx.rewardLog.create({
        data: {
          userId,
          type: payload.type,
          points,
          medals,
          fishFood,
          remark: payload.remark || '',
        },
      }),
    ]);

    return user;
  }

  async listLogs(userId: string) {
    const rows = await this.prisma.rewardLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      points: row.points,
      medals: row.medals,
      fishFood: row.fishFood,
      remark: row.remark,
      createdAt: row.createdAt.getTime(),
    }));
  }

  async checkIn(userId: string) {
    const user = await this.prisma.$transaction(async (tx) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const existing = await tx.rewardLog.findFirst({
        where: {
          userId,
          type: 'check_in',
          createdAt: { gte: start },
        },
      });
      if (existing) {
        throw new BadRequestException('今日已签到');
      }
      return this.grantInTransaction(tx, userId, {
        type: 'check_in',
        points: 5,
        fishFood: 1,
        remark: '每日签到',
      });
    });
    return this.authService.toUserProfile(user);
  }
}

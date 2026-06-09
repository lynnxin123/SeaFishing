import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../users/rewards.service';
import {
  CompetitionFeedbackDto,
  MeasureFishDto,
  WeightFishDto,
} from './dto/competition-tools.dto';
import { RegisterCompetitionDto } from './dto/register-competition.dto';

@Injectable()
export class CompetitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
  ) {}

  async list(limit?: number) {
    const take =
      limit && limit > 0 ? Math.min(Math.floor(limit), 50) : 20;
    const rows = await this.prisma.competition.findMany({
      where: { active: true },
      orderBy: { legacyId: 'asc' },
      take,
      select: {
        legacyId: true,
        enLabel: true,
        name: true,
        cover: true,
        status: true,
        statusText: true,
        location: true,
        time: true,
        fee: true,
        summary: true,
      },
    });
    return rows.map((item) => this.toListCompetition(item));
  }

  async listMyRegistrations(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));

    const where = { userId };
    const [total, rows] = await Promise.all([
      this.prisma.competitionRegistration.count({ where }),
      this.prisma.competitionRegistration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          competition: {
            select: {
              legacyId: true,
              name: true,
              cover: true,
              location: true,
              time: true,
              statusText: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: safePage,
      pageSize: safePageSize,
      items: rows.map((row) => ({
        id: row.id,
        realName: row.realName,
        phone: row.phone,
        people: row.people,
        emergencyContact: row.emergencyContact,
        remark: row.remark,
        createdAt: row.createdAt.getTime(),
        competitionId: String(row.competition.legacyId),
        competitionName: row.competition.name,
        competitionCover: row.competition.cover,
        competitionLocation: row.competition.location,
        competitionTime: row.competition.time,
        statusText: row.competition.statusText,
      })),
    };
  }

  async detail(legacyId: number) {
    const item = await this.findByLegacyId(legacyId);
    return this.toMiniCompetition(item);
  }

  async register(legacyId: number, userId: string, dto: RegisterCompetitionDto) {
    const competition = await this.findByLegacyId(legacyId);
    if (competition.status === 'ended') {
      throw new BadRequestException('该赛事已结束');
    }

    let registration;
    try {
      registration = await this.prisma.competitionRegistration.create({
        data: {
          competitionId: competition.id,
          userId,
          realName: dto.realName,
          phone: dto.phone,
          people: dto.people,
          emergencyContact: dto.emergencyContact || '',
          remark: dto.remark || '',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('您已报名该赛事');
      }
      throw error;
    }

    await this.rewardsService.grant(userId, {
      type: 'competition_register',
      points: 20,
      fishFood: 2,
      remark: `报名赛事：${competition.name}`,
    });

    return registration;
  }

  async getRanking(legacyId: number) {
    const competition = await this.findByLegacyId(legacyId);
    const rows = await this.prisma.competitionRanking.findMany({
      where: { competitionId: competition.id },
      orderBy: { totalScore: 'desc' },
      take: 50,
      select: {
        displayName: true,
        totalScore: true,
      },
    });
    return rows.map((row, index) => ({
      rank: index + 1,
      name: row.displayName,
      score: row.totalScore,
    }));
  }

  async getMyScore(userId: string, legacyId?: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    let competitionId: string | undefined;
    if (legacyId != null) {
      const competition = await this.findByLegacyId(legacyId);
      competitionId = competition.id;
    }

    const [measureCount, weightCount, ranking] = await Promise.all([
      this.prisma.competitionMeasureRecord.count({
        where: {
          userId,
          ...(competitionId ? { competitionId } : {}),
        },
      }),
      this.prisma.competitionWeightRecord.count({
        where: {
          userId,
          ...(competitionId ? { competitionId } : {}),
        },
      }),
      competitionId
        ? this.prisma.competitionRanking.findUnique({
            where: {
              competitionId_userId: { competitionId, userId },
            },
            select: { totalScore: true },
          })
        : Promise.resolve(null),
    ]);

    let rank = 0;
    if (ranking && competitionId) {
      const higher = await this.prisma.competitionRanking.count({
        where: {
          competitionId,
          totalScore: { gt: ranking.totalScore },
        },
      });
      rank = higher + 1;
    }

    return {
      displayName: user.realName || user.nickName,
      measureCount,
      weightCount,
      totalScore: ranking?.totalScore || 0,
      rank,
      bestScore: ranking?.totalScore || 0,
    };
  }

  async submitMeasure(legacyId: number, userId: string, dto: MeasureFishDto) {
    const competition = await this.findByLegacyId(legacyId);
    await this.ensureRegistered(competition.id, userId);

    const record = await this.prisma.competitionMeasureRecord.create({
      data: {
        competitionId: competition.id,
        userId,
        fishLengthCm: dto.fishLengthCm,
        fishSpecies: dto.fishSpecies || '',
      },
    });

    const delta = Number((dto.fishLengthCm / 10).toFixed(1));
    await this.bumpRanking(competition.id, userId, delta);
    await this.rewardsService.grant(userId, {
      type: 'competition_measure',
      points: 5,
      remark: `长度测量 ${dto.fishLengthCm}cm`,
    });

    return {
      id: record.id,
      fishLengthCm: record.fishLengthCm,
      fishSpecies: record.fishSpecies,
      createdAt: record.createdAt.getTime(),
    };
  }

  async submitWeight(legacyId: number, userId: string, dto: WeightFishDto) {
    const competition = await this.findByLegacyId(legacyId);
    await this.ensureRegistered(competition.id, userId);

    const record = await this.prisma.competitionWeightRecord.create({
      data: {
        competitionId: competition.id,
        userId,
        weightKg: dto.weightKg,
      },
    });

    const delta = Number(dto.weightKg.toFixed(1));
    await this.bumpRanking(competition.id, userId, delta);
    await this.rewardsService.grant(userId, {
      type: 'competition_weight',
      points: 8,
      remark: `比赛称重 ${dto.weightKg}kg`,
    });

    return {
      id: record.id,
      weightKg: record.weightKg,
      createdAt: record.createdAt.getTime(),
    };
  }

  async submitFeedback(userId: string, dto: CompetitionFeedbackDto) {
    let competitionDbId: string | null = null;
    if (dto.competitionId) {
      const competition = await this.findByLegacyId(Number(dto.competitionId));
      competitionDbId = competition.id;
    }

    const row = await this.prisma.competitionFeedback.create({
      data: {
        type: dto.type,
        userId,
        competitionId: competitionDbId,
        content: dto.content,
      },
    });

    return {
      id: row.id,
      type: row.type,
      status: row.status,
      createdAt: row.createdAt.getTime(),
    };
  }

  private async ensureRegistered(competitionId: string, userId: string) {
    const reg = await this.prisma.competitionRegistration.findFirst({
      where: { competitionId, userId },
    });
    if (!reg) {
      throw new BadRequestException('请先报名该赛事');
    }
  }

  private async bumpRanking(
    competitionId: string,
    userId: string,
    delta: number,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const displayName = user?.realName || user?.nickName || '选手';

    await this.prisma.competitionRanking.upsert({
      where: { competitionId_userId: { competitionId, userId } },
      create: {
        competitionId,
        userId,
        displayName,
        totalScore: delta,
        rank: 0,
      },
      update: {
        totalScore: { increment: delta },
        displayName,
      },
    });
  }

  private async findByLegacyId(legacyId: number) {
    const item = await this.prisma.competition.findFirst({
      where: { legacyId, active: true },
    });
    if (!item) {
      throw new NotFoundException('赛事不存在');
    }
    return item;
  }

  private toListCompetition(item: {
    legacyId: number;
    enLabel: string;
    name: string;
    cover: string;
    status: string;
    statusText: string;
    location: string;
    time: string;
    fee: string;
    summary: string;
  }) {
    return {
      id: String(item.legacyId),
      enLabel: item.enLabel,
      name: item.name,
      cover: item.cover,
      status: item.status,
      statusText: item.statusText,
      location: item.location,
      time: item.time,
      fee: item.fee,
      summary: item.summary,
    };
  }

  private toMiniCompetition(item: {
    legacyId: number;
    enLabel: string;
    name: string;
    cover: string;
    status: string;
    statusText: string;
    location: string;
    time: string;
    fee: string;
    summary: string;
    intro: string;
    rules: unknown;
    prizes: string;
    organizer: string;
  }) {
    const rules = Array.isArray(item.rules) ? (item.rules as string[]) : [];
    return {
      id: String(item.legacyId),
      enLabel: item.enLabel,
      name: item.name,
      cover: item.cover,
      status: item.status,
      statusText: item.statusText,
      location: item.location,
      time: item.time,
      fee: item.fee,
      summary: item.summary,
      intro: item.intro,
      rules,
      prizes: item.prizes,
      organizer: item.organizer,
    };
  }
}

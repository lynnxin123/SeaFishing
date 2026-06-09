import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, Public } from '../common/decorators';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import {
  CompetitionFeedbackDto,
  MeasureFishDto,
  WeightFishDto,
} from './dto/competition-tools.dto';
import { RegisterCompetitionDto } from './dto/register-competition.dto';
import { CompetitionsService } from './competitions.service';

class ListCompetitionsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

class MyScoreQuery {
  @IsOptional()
  @IsString()
  legacyId?: string;
}

class MyRegistrationsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Public()
  @Get()
  list(@Query() query: ListCompetitionsQuery) {
    return this.competitionsService.list(query.limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/registrations')
  myRegistrations(
    @CurrentUser() user: { userId: string },
    @Query() query: MyRegistrationsQuery,
  ) {
    return this.competitionsService.listMyRegistrations(
      user.userId,
      query.page,
      query.pageSize,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/score')
  myScore(
    @CurrentUser() user: { userId: string },
    @Query() query: MyScoreQuery,
  ) {
    const legacyId = query.legacyId ? Number(query.legacyId) : undefined;
    return this.competitionsService.getMyScore(user.userId, legacyId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('feedback')
  feedback(
    @CurrentUser() user: { userId: string },
    @Body() dto: CompetitionFeedbackDto,
  ) {
    return this.competitionsService.submitFeedback(user.userId, dto);
  }

  @Public()
  @Get(':legacyId/ranking')
  ranking(@Param('legacyId') legacyId: string) {
    return this.competitionsService.getRanking(Number(legacyId));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':legacyId/measure')
  measure(
    @Param('legacyId') legacyId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: MeasureFishDto,
  ) {
    return this.competitionsService.submitMeasure(
      Number(legacyId),
      user.userId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':legacyId/weight')
  weight(
    @Param('legacyId') legacyId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: WeightFishDto,
  ) {
    return this.competitionsService.submitWeight(
      Number(legacyId),
      user.userId,
      dto,
    );
  }

  @Public()
  @Get(':legacyId')
  detail(@Param('legacyId') legacyId: string) {
    return this.competitionsService.detail(Number(legacyId));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':legacyId/register')
  register(
    @Param('legacyId') legacyId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: RegisterCompetitionDto,
  ) {
    return this.competitionsService.register(Number(legacyId), user.userId, dto);
  }
}

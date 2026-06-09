import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CurrentUser, Public } from '../common/decorators';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { BoatsService } from './boats.service';
import { CreateBoatReviewDto } from './dto/create-boat-review.dto';
import { ListBoatsDto } from './dto/list-boats.dto';

class FavoritePageQuery {
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

@Controller('boats')
export class BoatsController {
  constructor(private readonly boatsService: BoatsService) {}

  @Public()
  @Get()
  list(@Query() query: ListBoatsDto) {
    return this.boatsService.list(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('favorites/me')
  myFavorites(
    @CurrentUser() user: { userId: string },
    @Query() query: FavoritePageQuery,
  ) {
    return this.boatsService.listMyFavorites(
      user.userId,
      query.page,
      query.pageSize,
    );
  }

  @Public()
  @Get(':boatId/reviews')
  reviews(@Param('boatId') boatId: string) {
    return this.boatsService.listReviews(boatId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':boatId/reviews')
  createReview(
    @Param('boatId') boatId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateBoatReviewDto,
  ) {
    return this.boatsService.createReview(boatId, user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':boatId/favorite')
  favoriteStatus(
    @Param('boatId') boatId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.boatsService.isFavorite(user.userId, boatId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':boatId/favorite')
  addFavorite(
    @Param('boatId') boatId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.boatsService.addFavorite(user.userId, boatId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':boatId/favorite')
  removeFavorite(
    @Param('boatId') boatId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.boatsService.removeFavorite(user.userId, boatId);
  }

  @Public()
  @Get(':boatId')
  detail(@Param('boatId') boatId: string) {
    return this.boatsService.detail(boatId);
  }
}

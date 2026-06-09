import {
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
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

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

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get('keys')
  listKeys(@CurrentUser() user: { userId: string }) {
    return this.favoritesService.listSpotKeys(user.userId);
  }

  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query() query: FavoritePageQuery,
  ) {
    return this.favoritesService.list(
      user.userId,
      query.page,
      query.pageSize,
    );
  }

  @Post(':spotKey')
  add(
    @CurrentUser() user: { userId: string },
    @Param('spotKey') spotKey: string,
  ) {
    return this.favoritesService.add(user.userId, spotKey);
  }

  @Delete(':spotKey')
  remove(
    @CurrentUser() user: { userId: string },
    @Param('spotKey') spotKey: string,
  ) {
    return this.favoritesService.remove(user.userId, spotKey);
  }
}

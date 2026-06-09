import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SyncBookingsDto } from './dto/sync-bookings.dto';

class ListBookingsQuery {
  @IsOptional()
  @IsString()
  status?: string;

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

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }, @Query() query: ListBookingsQuery) {
    return this.bookingsService.list(
      user.userId,
      query.status,
      query.page,
      query.pageSize,
    );
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.userId, dto);
  }

  @Post('sync-batch')
  syncBatch(
    @CurrentUser() user: { userId: string },
    @Body() dto: SyncBookingsDto,
  ) {
    return this.bookingsService.syncBatch(user.userId, dto.items || []);
  }

  @Patch(':id/cancel')
  cancel(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.bookingsService.cancel(user.userId, id);
  }
}

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
import { CurrentUser, Public } from '../common/decorators';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
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

class SlotAvailabilityQuery {
  @IsString()
  boatId!: string;

  @IsString()
  date!: string;
}

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Public()
  @Get('rules')
  rules() {
    return this.bookingsService.getPublicRules();
  }

  @Public()
  @Get('slots/availability')
  slotAvailability(@Query() query: SlotAvailabilityQuery) {
    return this.bookingsService.getSlotAvailability(query.boatId, query.date);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: { userId: string }, @Query() query: ListBookingsQuery) {
    return this.bookingsService.list(
      user.userId,
      query.status,
      query.page,
      query.pageSize,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/cancel-preview')
  cancelPreview(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.bookingsService.cancelPreview(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  detail(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.bookingsService.detail(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('can-book')
  canBook(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.canBookPreview(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync-batch')
  syncBatch(
    @CurrentUser() user: { userId: string },
    @Body() dto: SyncBookingsDto,
  ) {
    return this.bookingsService.syncBatch(user.userId, dto.items || []);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/pay')
  pay(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.bookingsService.pay(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancel(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(user.userId, id, dto);
  }
}

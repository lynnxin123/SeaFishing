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
import { Public } from '../common/decorators';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { UpsertBoatDto } from './dto/upsert-boat.dto';

class AdminBookingsQuery {
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

class AdminPageQuery {
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

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Post('auth/login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('bookings')
  listBookings(@Query() query: AdminBookingsQuery) {
    return this.adminService.listBookings(
      query.status,
      query.page,
      query.pageSize,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Patch('bookings/:id/status')
  updateBookingStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.adminService.updateBookingStatus(id, dto.status);
  }

  @UseGuards(AdminAuthGuard)
  @Get('boats')
  listBoats(@Query() query: AdminPageQuery) {
    return this.adminService.listBoats(query.page, query.pageSize);
  }

  @UseGuards(AdminAuthGuard)
  @Post('boats')
  createBoat(@Body() dto: UpsertBoatDto) {
    return this.adminService.createBoat(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('boats/:boatId')
  updateBoat(@Param('boatId') boatId: string, @Body() dto: UpsertBoatDto) {
    return this.adminService.updateBoat(boatId, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('competitions')
  listCompetitions() {
    return this.adminService.listCompetitions();
  }

  @UseGuards(AdminAuthGuard)
  @Get('competitions/:legacyId/registrations')
  listRegistrations(
    @Param('legacyId') legacyId: string,
    @Query() query: AdminPageQuery,
  ) {
    return this.adminService.listRegistrations(
      Number(legacyId),
      query.page,
      query.pageSize,
    );
  }
}

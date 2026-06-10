import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { UsersService } from './users.service';
import { RewardsService } from './rewards.service';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  nickName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  wechatId?: string;
}

class VerifyIdDto {
  @IsString()
  realName!: string;

  @IsString()
  idNumber!: string;

  @IsOptional()
  @IsString()
  idType?: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rewardsService: RewardsService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: { userId: string }) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: { userId: string }, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Patch('me/verify')
  verify(@CurrentUser() user: { userId: string }, @Body() dto: VerifyIdDto) {
    return this.usersService.verifyIdentity(user.userId, dto);
  }

  @Get('me/rewards')
  rewardLogs(@CurrentUser() user: { userId: string }) {
    return this.rewardsService.listLogs(user.userId);
  }

  @Post('me/check-in')
  checkIn(@CurrentUser() user: { userId: string }) {
    return this.rewardsService.checkIn(user.userId);
  }
}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RewardsService } from './rewards.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, RewardsService],
  exports: [UsersService, RewardsService],
})
export class UsersModule {}

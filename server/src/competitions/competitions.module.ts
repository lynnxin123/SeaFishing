import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { CompetitionStartReminderService } from './competition-start-reminder.service';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';

@Module({
  imports: [UsersModule, MessagesModule],
  controllers: [CompetitionsController],
  providers: [CompetitionsService, CompetitionStartReminderService],
  exports: [CompetitionsService, CompetitionStartReminderService],
})
export class CompetitionsModule {}

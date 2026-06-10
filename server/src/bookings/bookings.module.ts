import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { BookingsController } from './bookings.controller';
import { BookingPaymentReminderService } from './booking-payment-reminder.service';
import { BookingRulesService } from './booking-rules.service';
import { BookingsService } from './bookings.service';

@Module({
  imports: [UsersModule, MessagesModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    BookingRulesService,
    BookingPaymentReminderService,
  ],
  exports: [BookingsService, BookingRulesService],
})
export class BookingsModule {}

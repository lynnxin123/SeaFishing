import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';

export class SyncBookingsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateBookingDto)
  items!: CreateBookingDto[];
}

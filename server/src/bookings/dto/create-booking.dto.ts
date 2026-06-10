import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBookingDto {
  @IsOptional()
  @IsString()
  boatId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  shipName?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsString()
  wharf?: string;

  @IsOptional()
  @IsString()
  departWharf?: string;

  @IsString()
  date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  people!: number;

  @IsOptional()
  @IsString()
  captainName?: string;

  @IsOptional()
  @IsString()
  status?: 'pending_pay' | 'pending_accept';

  /** 散拼 shared / 包船 charter */
  @IsOptional()
  @IsEnum(['shared', 'charter'])
  bookingType?: 'shared' | 'charter';

  /** 出航时段 id 或 slotKey */
  @IsOptional()
  @IsString()
  sailSlotId?: string;

  @IsOptional()
  @IsString()
  slotTime?: string;
}

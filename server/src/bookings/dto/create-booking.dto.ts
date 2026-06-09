import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateBookingDto {
  @IsOptional()
  @IsString()
  boatId?: string;

  @IsString()
  @MinLength(1)
  shipName!: string;

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
}

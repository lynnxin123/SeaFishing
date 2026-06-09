import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpsertBoatDto {
  @IsString()
  @MinLength(1)
  boatId!: string;

  @IsString()
  @MinLength(1)
  shipName!: string;

  @IsOptional()
  @IsNumber()
  maxNum?: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  wharf?: string;

  @IsOptional()
  @IsString()
  captain?: string;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsArray()
  facilities?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListBoatsDto {
  @IsOptional()
  @IsString()
  wharf?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  /** 逗号分隔的业务船号，如 SHENHAI001,LANHAI001 */
  @IsOptional()
  @IsString()
  boatIds?: string;

  @IsOptional()
  @IsString()
  sort?: 'comprehensive' | 'priceAsc' | 'priceDesc';

  @IsOptional()
  @Type(() => Number)
  minScore?: number;

  @IsOptional()
  @Type(() => Number)
  minLength?: number;

  @IsOptional()
  @Type(() => Number)
  minExperience?: number;

  /** 逗号分隔的设施，如 卫生间,休息室 */
  @IsOptional()
  @IsString()
  facilities?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 50;

  /** 乘船人数，筛选 maxNum >= people 的船只 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  people?: number;
}

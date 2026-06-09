import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterCompetitionDto {
  @IsString()
  @MinLength(1)
  realName!: string;

  @IsString()
  @MinLength(11)
  phone!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  people!: number;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

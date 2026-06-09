import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class MeasureFishDto {
  @IsNumber()
  @Min(1)
  fishLengthCm!: number;

  @IsOptional()
  @IsString()
  fishSpecies?: string;
}

export class WeightFishDto {
  @IsNumber()
  @Min(0.1)
  weightKg!: number;
}

export class CompetitionFeedbackDto {
  @IsIn(['report', 'appeal'])
  type!: 'report' | 'appeal';

  @IsString()
  @MinLength(4)
  content!: string;

  @IsOptional()
  @IsString()
  competitionId?: string;
}

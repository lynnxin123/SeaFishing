import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateBoatReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsString()
  @MinLength(2)
  content!: string;
}

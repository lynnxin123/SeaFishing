import { IsIn, IsOptional, IsString } from 'class-validator';

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;

  /** user=用户取消 weather=天气禁航全额退 */
  @IsOptional()
  @IsIn(['user', 'weather'])
  cancelType?: 'user' | 'weather';
}

import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators';
import { SpotsService } from './spots.service';

@Controller('spots')
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  @Public()
  @Get()
  list() {
    return this.spotsService.list();
  }

  @Public()
  @Get(':spotKey')
  detail(@Param('spotKey') spotKey: string) {
    return this.spotsService.detail(spotKey);
  }
}

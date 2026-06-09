import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators';
import { BannersService } from './banners.service';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get()
  list() {
    return this.bannersService.list();
  }
}

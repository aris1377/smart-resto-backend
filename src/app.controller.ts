import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Guardlar global — health-check ochiq qolishi uchun @Public() kerak
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

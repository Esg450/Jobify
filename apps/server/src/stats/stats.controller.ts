import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators.js';
import type { PublicUser } from '../users/users.service.js';
import { StatsService } from './stats.service.js';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  overview(@CurrentUser() user: PublicUser) {
    return this.stats.overview(user.id);
  }
}

import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators.js';
import type { PublicUser } from '../users/users.service.js';
import { StatsService } from './stats.service.js';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  overview(
    @CurrentUser() user: PublicUser,
    @Query('huntId', new ParseIntPipe({ optional: true })) huntId?: number,
  ) {
    return this.stats.overview(user.id, huntId);
  }

  @Get('hunts')
  hunts(@CurrentUser() user: PublicUser) {
    return this.stats.huntSummaries(user.id);
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { AdminOnly, CurrentUser } from '../auth/decorators.js';
import type { PublicUser } from '../users/users.service.js';
import { CheckSearchResultsDto } from './search-check.dto.js';
import { SearchJobsDto } from './search-query.dto.js';
import { TestSearchSettingsDto, UpdateSearchSettingsDto } from './search-settings.js';
import { SearchService } from './search.service.js';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('settings')
  getSettings() {
    return this.search.getPublicSettings();
  }

  /** The service is shared by everyone on the instance, so only admins change it. */
  @Put('settings')
  @AdminOnly()
  updateSettings(@Body() dto: UpdateSearchSettingsDto) {
    return this.search.updateSettings(dto);
  }

  /** Tries the values in the form before they are saved. */
  @Post('test')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  test(@Body() dto: TestSearchSettingsDto) {
    return this.search.testConnection(dto);
  }

  /** Searches the boards. Nothing is saved; results are drafts for the Add job page. */
  @Post()
  @HttpCode(HttpStatus.OK)
  query(@CurrentUser() user: PublicUser, @Body() dto: SearchJobsDto) {
    return this.search.search(user.id, dto);
  }

  /** Searches the AI proposes from the user's profile. Fills the form; the user runs it. */
  @Post('suggest')
  @HttpCode(HttpStatus.OK)
  async suggest(@CurrentUser() user: PublicUser) {
    return { suggestions: await this.search.suggest(user.id) };
  }

  /** Which of some earlier results the user has saved since. */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  check(@CurrentUser() user: PublicUser, @Body() dto: CheckSearchResultsDto) {
    return this.search.check(user.id, dto.candidates);
  }
}

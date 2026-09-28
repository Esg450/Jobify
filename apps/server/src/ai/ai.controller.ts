import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';
import { AdminOnly, CurrentUser } from '../auth/decorators.js';
import type { PublicUser } from '../users/users.service.js';
import { AI_PROVIDERS, UpdateAiSettingsDto } from './ai-settings.js';
import { AiService } from './ai.service.js';
import { AI_TASKS, type AiTask } from './prompts.js';

class RunTaskParams {
  @Type(() => Number)
  @IsInt()
  id!: number;

  @IsIn(AI_TASKS)
  task!: AiTask;
}

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('providers')
  providers() {
    return AI_PROVIDERS;
  }

  @Get('settings')
  getSettings() {
    return this.ai.getPublicSettings();
  }

  /** The provider and key are shared by everyone on the instance, so only admins change them. */
  @Put('settings')
  @AdminOnly()
  updateSettings(@Body() dto: UpdateAiSettingsDto) {
    return this.ai.updateSettings(dto);
  }

  @Post('test')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  test() {
    return this.ai.testConnection();
  }

  @Post('jobs/:id/:task')
  @HttpCode(HttpStatus.OK)
  runTask(@CurrentUser() user: PublicUser, @Param() { id, task }: RunTaskParams) {
    return this.ai.runTask(user.id, id, task);
  }
}

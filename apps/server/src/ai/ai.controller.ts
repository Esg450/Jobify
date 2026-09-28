import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';
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

  @Put('settings')
  updateSettings(@Body() dto: UpdateAiSettingsDto) {
    return this.ai.updateSettings(dto);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  test() {
    return this.ai.testConnection();
  }

  @Post('jobs/:id/:task')
  @HttpCode(HttpStatus.OK)
  runTask(@Param() { id, task }: RunTaskParams) {
    return this.ai.runTask(id, task);
  }
}

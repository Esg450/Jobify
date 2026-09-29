import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators.js';
import type { PublicUser } from '../users/users.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { CreateJobEventDto, UpdateJobEventDto } from './dto/job-event.dto.js';
import { QueryJobsDto } from './dto/query-jobs.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { JobsService } from './jobs.service.js';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@CurrentUser() user: PublicUser, @Query() query: QueryJobsDto) {
    return this.jobs.list(user.id, query);
  }

  /** Declared before ':id' so the path is not read as a job id. */
  @Get('timeline')
  timeline(@CurrentUser() user: PublicUser, @Query('includeArchived') includeArchived?: string) {
    return this.jobs.timeline(user.id, includeArchived === 'true');
  }

  @Get(':id')
  findOne(@CurrentUser() user: PublicUser, @Param('id', ParseIntPipe) id: number) {
    return this.jobs.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateJobDto) {
    return this.jobs.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobs.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: PublicUser, @Param('id', ParseIntPipe) id: number) {
    return this.jobs.remove(user.id, id);
  }

  @Post(':id/events')
  addEvent(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateJobEventDto,
  ) {
    return this.jobs.addEvent(user.id, id, dto);
  }

  @Patch(':id/events/:eventId')
  updateEvent(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: UpdateJobEventDto,
  ) {
    return this.jobs.updateEvent(user.id, id, eventId, dto);
  }

  @Delete(':id/events/:eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEvent(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.jobs.removeEvent(user.id, id, eventId);
  }
}
